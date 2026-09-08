// Orbit media engine: a small HTTP API that wraps yt-dlp (download/analyze)
// and ffmpeg (format conversion, watermark removal). Runs locally or on your
// own server; the website (app/page.tsx) is the only intended client.
// Route map: POST /analyze, POST /download, POST /edit, POST /upload,
// GET /jobs, GET/DELETE /jobs/:id, GET /jobs/:id/file, GET /health.
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  statSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEgressProxy, validateUrl } from './network.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const media = path.join(root, '.media');
mkdirSync(media, { recursive: true });
const python =
  process.env.ORBIT_PYTHON ||
  path.join(
    root,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
const ffmpeg =
  process.env.ORBIT_FFMPEG ||
  path.join(
    root,
    '.tools',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  );
const port = Number(process.env.ORBIT_PORT || 4318);
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.ORBIT_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
]);
const key = process.env.ORBIT_API_KEY || '';
const host = process.env.ORBIT_HOST || '127.0.0.1';
if (host !== '127.0.0.1' && host !== 'localhost' && key.length < 24)
  throw new Error(
    'A public engine requires an ORBIT_API_KEY of at least 24 characters.',
  );
const proxy = await startEgressProxy();
const cookies =
  process.env.ORBIT_COOKIES_FILE && existsSync(process.env.ORBIT_COOKIES_FILE)
    ? ['--cookies', process.env.ORBIT_COOKIES_FILE]
    : [];
// The bgutil-ytdlp-pot-provider companion container mints the "proof of
// origin" tokens YouTube requires from server IPs; see docker-compose.yml.
// Set ORBIT_POT_PROVIDER_URL='' to disable if not running that service.
const potProviderUrl =
  process.env.ORBIT_POT_PROVIDER_URL ?? 'http://bgutil-provider:4416';
const botTokenHost = potProviderUrl ? new URL(potProviderUrl).hostname : '';
const common = [
  '-m',
  'yt_dlp',
  '--ignore-config',
  '--no-cache-dir',
  '--no-playlist',
  '--no-warnings',
  '--socket-timeout',
  '20',
  '--retries',
  '2',
  '--proxy',
  proxy.url,
  '--js-runtimes',
  `node:${process.execPath}`,
  '--ffmpeg-location',
  ffmpeg,
  ...cookies,
  ...(potProviderUrl
    ? ['--extractor-args', `youtubepot-bgutilhttp:base_url=${potProviderUrl}`]
    : []),
];
// Discard stale temporary uploads from previous sessions; completed files remain.
for (const name of readdirSync(media)) {
  if (
    /^[a-f0-9-]{36}\.upload$/.test(name) &&
    Date.now() - statSync(path.join(media, name)).mtimeMs > 24 * 60 * 60 * 1000
  )
    unlinkSync(path.join(media, name));
}
const children = new Set();
const jobs = new Map();
const metadata = new Map();
const uploads = new Map();
const processes = new Map();
const statePath = path.join(media, 'jobs.json');
if (existsSync(statePath)) {
  try {
    for (const j of JSON.parse(readFileSync(statePath, 'utf8'))) {
      if (['queued', 'processing'].includes(j.status)) {
        j.status = 'failed';
        j.error = 'The engine restarted before this task finished.';
      }
      if (j.file && !existsSync(path.join(media, j.file))) {
        delete j.file;
        j.status = 'expired';
      }
      jobs.set(j.id, j);
    }
  } catch {}
}
const save = () => {
  writeFileSync(
    statePath + '.tmp',
    JSON.stringify([...jobs.values()].slice(-200)),
  );
  renameSync(statePath + '.tmp', statePath);
};
const publicJob = (j) => ({
  id: j.id,
  title: j.title,
  kind: j.kind,
  status: j.status,
  progress: j.progress,
  createdAt: j.createdAt,
  size: j.size,
  error: j.error,
  filename: j.filename,
});
// yt-dlp's raw errors are written for people running it in a terminal:
// they cite command-line flags and link to wiki pages, which is noise to
// someone using this as a website. Translate the ones users actually hit
// into something actionable, and pass anything unrecognized through.
const errorTranslations = [
  [
    /not a bot|sign in to confirm/i,
    'This source is blocking downloads from this server right now. Other videos may still work; try again later or try a different link.',
  ],
  [
    /only works when logged-in|cookies|authentication/i,
    'This source requires a signed-in session to download, which this server does not have.',
  ],
  [
    /private video|members-only|join this channel/i,
    'This video is private or restricted to members, so it cannot be downloaded.',
  ],
  [
    /video unavailable|has been removed|no longer available|404/i,
    'This video is unavailable. It may have been removed, or the link may be wrong.',
  ],
  [
    /age|confirm your age/i,
    'This video is age-restricted and cannot be downloaded without a signed-in account.',
  ],
  [
    /geo|not available in your country|blocked it in your country/i,
    'This video is not available in the region where this server is located.',
  ],
  [
    /live event|is live/i,
    'Live streams cannot be downloaded. Try again once the stream has ended.',
  ],
];
function friendlyError(raw) {
  for (const [pattern, message] of errorTranslations)
    if (pattern.test(raw)) return message;
  return raw;
}
function run(command, args, { timeout = 90000, onOutput, jobId } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      cwd: media,
      env: {
        ...process.env,
        HTTP_PROXY: proxy.url,
        HTTPS_PROXY: proxy.url,
        ALL_PROXY: proxy.url,
        // The bgutil PO-token provider is our own trusted internal service,
        // not an extractor-controlled destination, so it's exempt from the
        // SSRF-blocking egress proxy that everything else routes through.
        NO_PROXY: botTokenHost,
      },
    });
    children.add(child);
    if (jobId) processes.set(jobId, child);
    let output = '',
      error = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Processing timed out. Try a shorter video.'));
    }, timeout);
    child.stdout.on('data', (d) => {
      const s = d.toString();
      output += s;
      if (output.length > 16e6) {
        child.kill();
        reject(new Error('Source metadata is too large.'));
      }
      onOutput?.(s);
    });
    child.stderr.on('data', (d) => {
      error = (error + d).slice(-12000);
      onOutput?.(d.toString());
    });
    child.on('error', (e) => {
      children.delete(child);
      clearTimeout(timer);
      if (jobId) processes.delete(jobId);
      reject(e);
    });
    child.on('close', (code) => {
      children.delete(child);
      clearTimeout(timer);
      if (jobId) processes.delete(jobId);
      code === 0
        ? resolve({ output, error })
        : reject(
            new Error(
              friendlyError(
                error
                  .replace(/\x1b\[[0-9;]*m/g, '')
                  .split('\n')
                  .filter((l) => l.startsWith('ERROR:'))
                  .join(' ')
                  .slice(0, 600) ||
                  error.slice(-400) ||
                  'Media processing stopped.',
              ),
            ),
          );
    });
  });
}
async function analyze(value) {
  const url = validateUrl(value);
  const { output } = await run(python, [
    ...common,
    '--dump-single-json',
    '--skip-download',
    '--',
    url.href,
  ]);
  const raw = JSON.parse(output);
  if (raw.is_live || raw.live_status === 'is_live')
    throw new Error('Live streams are not supported. Try a finished video.');
  if (raw._type === 'playlist' || raw.entries)
    throw new Error('Use individual video links in Batch download.');
  if (raw.has_drm)
    throw new Error('This video is protected and cannot be downloaded.');
  const formats = (raw.formats || [raw]).filter(
    (f) =>
      !f.has_drm &&
      ['http', 'https', 'm3u8_native', 'http_dash_segments', 'm3u8'].includes(
        f.protocol || 'https',
      ),
  );
  if (!formats.length)
    throw new Error('No downloadable formats were provided by this source.');
  const result = {
    id: randomUUID(),
    url: url.href,
    title: raw.title || 'Untitled video',
    source: raw.extractor_key || url.hostname,
    duration: raw.duration || 0,
    thumbnail: raw.thumbnail?.startsWith('https://') ? raw.thumbnail : null,
    heights: [
      ...new Set(
        formats
          .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
          .map((f) => f.height),
      ),
    ].sort((a, b) => b - a),
    hasAudio: formats.some((f) => f.acodec && f.acodec !== 'none')
      ? true
      : formats.every((f) => f.acodec === 'none')
        ? false
        : null,
    hasVideo: formats.some(
      (f) =>
        (f.vcodec && f.vcodec !== 'none') ||
        (!f.vcodec && ['mp4', 'webm', 'mov', 'mkv', 'm4v'].includes(f.ext)),
    ),
    expires: Date.now() + 30 * 60 * 1000,
  };
  metadata.set(result.id, result);
  return result;
}
const queue = [];
let running = 0;
function enqueue(job, task) {
  if (
    [...jobs.values()].filter((j) =>
      ['queued', 'processing'].includes(j.status),
    ).length >= 20
  )
    throw new Error('Your queue is full. Wait for a download to finish.');
  jobs.set(job.id, job);
  queue.push({ job, task });
  save();
  drain();
  return publicJob(job);
}
function drain() {
  while (running < 2 && queue.length) {
    const { job, task } = queue.shift();
    if (job.status === 'cancelled') continue;
    running++;
    job.status = 'processing';
    save();
    task()
      .then((file) => {
        if (job.status === 'cancelled') return;
        job.file = path.basename(file);
        job.size = statSync(file).size;
        job.filename =
          job.title.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100) +
          path.extname(file);
        job.status = 'completed';
        job.progress = 100;
      })
      .catch((e) => {
        if (job.status !== 'cancelled') {
          job.status = 'failed';
          job.error = e.message;
        }
      })
      .finally(() => {
        running--;
        save();
        drain();
      });
  }
}
function makeJob(title, kind) {
  return {
    id: randomUUID(),
    title,
    kind,
    status: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
  };
}
async function download(data) {
  const info = metadata.get(data.mediaId);
  if (!info || info.expires < Date.now())
    throw new Error('This preview expired. Analyze the link again.');
  const kind = data.kind === 'audio' ? 'audio' : 'video';
  if (kind === 'audio' && info.hasAudio === false)
    throw new Error('This source has no audio stream.');
  const height = data.height === 'best' ? 'best' : Number(data.height);
  if (height !== 'best' && !info.heights.includes(height))
    throw new Error('Choose an available quality.');
  const job = makeJob(info.title, kind);
  job.sourceUrl = info.url;
  return enqueue(job, async () => {
    const format =
      kind === 'audio'
        ? 'bestaudio/best'
        : height === 'best'
          ? 'bestvideo*+bestaudio/best'
          : `bestvideo*[height<=${height}]+bestaudio/best[height<=${height}]`;
    await run(
      python,
      [
        ...common,
        '--newline',
        '--progress',
        '--progress-template',
        'download:ORBIT:%(progress._percent_str)s',
        '--max-filesize',
        '1G',
        '--hls-prefer-native',
        '--no-continue',
        '-f',
        format,
        '--merge-output-format',
        'mp4',
        '-o',
        `${job.id}.source.%(ext)s`,
        '--',
        info.url,
      ],
      {
        timeout: 20 * 60 * 1000,
        jobId: job.id,
        onOutput: (s) => {
          const m = s.match(/ORBIT:\s*([\d.]+)%/);
          if (m) job.progress = Math.min(88, Number(m[1]) * 0.88);
        },
      },
    );
    if (job.status === 'cancelled') throw new Error('Cancelled.');
    const name = readdirSync(media).find(
      (f) =>
        f.startsWith(job.id + '.source.') &&
        !f.endsWith('.part') &&
        !f.endsWith('.ytdl') &&
        !/\.f\d+\./.test(f),
    );
    if (!name) throw new Error('The source did not produce a media file.');
    const input = path.join(media, name);
    const output = path.join(
      media,
      `${job.id}.${kind === 'audio' ? 'mp3' : 'mp4'}`,
    );
    job.progress = 90;
    const conversion =
      kind === 'audio'
        ? ['-vn', '-codec:a', 'libmp3lame', '-b:a', '192k']
        : [
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '20',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            '-vf',
            'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          ];
    await run(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-protocol_whitelist',
        'file,pipe,crypto,data',
        '-i',
        input,
        ...conversion,
        output,
      ],
      { timeout: 20 * 60 * 1000, jobId: job.id },
    );
    unlinkSync(input);
    return output;
  });
}
async function edit(data) {
  const upload = uploads.get(data.uploadId);
  if (!upload) throw new Error('Upload your video again.');
  const { width: iw, height: ih } = upload;
  const region = data.region;
  if (
    !region ||
    !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(region[k]))
  )
    throw new Error('Select a valid watermark region.');
  const x = Math.max(2, Math.floor((region.x * iw) / 100));
  const y = Math.max(2, Math.floor((region.y * ih) / 100));
  const w = Math.floor((region.width * iw) / 100);
  const h = Math.floor((region.height * ih) / 100);
  if (w < 4 || h < 4 || x + w >= iw - 1 || y + h >= ih - 1)
    throw new Error(
      'Keep the selection inside the video with a small margin around every edge.',
    );
  if (!['delogo', 'blur'].includes(data.method))
    throw new Error('Choose a valid editing method.');
  const job = makeJob(
    upload.name.replace(/\.[^.]+$/, '') + ' — cleaned',
    'watermark',
  );
  return enqueue(job, async () => {
    const output = path.join(media, `${job.id}.mp4`);
    const filter =
      data.method === 'delogo'
        ? `delogo=x=${x}:y=${y}:w=${w}:h=${h},scale=trunc(iw/2)*2:trunc(ih/2)*2`
        : `split[base][area];[area]crop=${w}:${h}:${x}:${y},boxblur=${Math.max(1, Math.min(12, Math.floor(Math.min(w, h) / 4)))}:2[blur];[base][blur]overlay=${x}:${y},scale=trunc(iw/2)*2:trunc(ih/2)*2`;
    await run(
      ffmpeg,
      [
        '-hide_banner',
        '-y',
        '-protocol_whitelist',
        'file,pipe,crypto,data',
        '-i',
        upload.path,
        '-vf',
        filter,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-progress',
        'pipe:1',
        '-nostats',
        output,
      ],
      {
        timeout: 20 * 60 * 1000,
        jobId: job.id,
        onOutput: (s) => {
          const m = s.match(/out_time_us=(\d+)/);
          if (m && upload.duration)
            job.progress = Math.min(
              99,
              (Number(m[1]) / 1e6 / upload.duration) * 100,
            );
        },
      },
    );
    return output;
  });
}
function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 32768) throw new Error('Request too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
function validToken(value) {
  const a = Buffer.from(value || ''),
    b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
let analyzing = 0,
  uploading = 0;
const server = http.createServer(async (req, res) => {
  try {
    if (
      host === '127.0.0.1' &&
      !['localhost', '127.0.0.1'].includes(
        (req.headers.host || '').split(':')[0],
      )
    )
      return send(res, 403, { error: 'Invalid engine host.' });
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin))
      return send(res, 403, {
        error:
          'This website is not connected to your engine. Add its exact URL to ORBIT_ALLOWED_ORIGINS.',
      });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-File-Name',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    if (key && !validToken(req.headers.authorization?.replace(/^Bearer /, '')))
      return send(res, 401, {
        error: 'Your engine key is missing or incorrect.',
      });
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname.replace(/^\/api/, '');
    if (req.method === 'GET' && route === '/health')
      return send(res, 200, {
        ok: existsSync(python) && existsSync(ffmpeg),
        name: 'Orbit media engine',
        version: 1,
      });
    if (req.method === 'POST' && route === '/analyze') {
      if (analyzing >= 2)
        return send(res, 429, {
          error: 'Two links are being analyzed. Please try again shortly.',
        });
      analyzing++;
      try {
        return send(res, 200, await analyze((await body(req)).url));
      } finally {
        analyzing--;
      }
    }
    if (req.method === 'POST' && route === '/download')
      return send(res, 202, await download(await body(req)));
    if (req.method === 'POST' && route === '/edit')
      return send(res, 202, await edit(await body(req)));
    if (req.method === 'POST' && route === '/upload') {
      if (uploading >= 2)
        return send(res, 429, { error: 'Wait for another upload to finish.' });
      if (!String(req.headers['content-type']).startsWith('video/'))
        return send(res, 400, { error: 'Choose a video file.' });
      const id = randomUUID();
      const file = path.join(media, id + '.upload');
      let bytes = 0;
      uploading++;
      try {
        await pipeline(
          req,
          new Transform({
            transform(chunk, encoding, callback) {
              bytes += chunk.length;
              callback(
                bytes > 512 * 1024 * 1024
                  ? new Error('The maximum upload size is 512 MB.')
                  : null,
                chunk,
              );
            },
          }),
          createWriteStream(file),
        );
        const probe = spawnSync(
          ffmpeg,
          [
            '-hide_banner',
            '-protocol_whitelist',
            'file,pipe,crypto,data',
            '-i',
            file,
          ],
          {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 15000,
            maxBuffer: 2 * 1024 * 1024,
          },
        );
        const output = probe.stderr || '';
        const dimensions = output.match(/Video:.*?\b(\d{2,5})x(\d{2,5})\b/);
        const duration = output.match(/Duration: (\d+):(\d+):([\d.]+)/);
        if (!dimensions || !duration)
          throw new Error(
            'This file is not a supported video. Try MP4, MOV, or WebM.',
          );
        const record = {
          id,
          path: file,
          name: decodeURIComponent(
            String(req.headers['x-file-name'] || 'Video'),
          ).slice(0, 150),
          width: Number(dimensions[1]),
          height: Number(dimensions[2]),
          duration:
            Number(duration[1]) * 3600 +
            Number(duration[2]) * 60 +
            Number(duration[3]),
        };
        if (
          record.width > 8192 ||
          record.height > 8192 ||
          record.duration > 3600
        )
          throw new Error('Choose a video under one hour and up to 8K.');
        uploads.set(id, record);
        return send(res, 201, {
          id,
          name: record.name,
          width: record.width,
          height: record.height,
          duration: record.duration,
        });
      } catch (e) {
        if (existsSync(file)) unlinkSync(file);
        throw e;
      } finally {
        uploading--;
      }
    }
    if (req.method === 'GET' && route === '/jobs')
      return send(res, 200, [...jobs.values()].map(publicJob).reverse());
    const match = route.match(/^\/jobs\/([a-f0-9-]{36})(\/file)?$/);
    if (match) {
      const job = jobs.get(match[1]);
      if (!job) return send(res, 404, { error: 'Download not found.' });
      if (req.method === 'DELETE') {
        if (job.status === 'processing' || job.status === 'queued') {
          job.status = 'cancelled';
          processes.get(job.id)?.kill();
          save();
          return send(res, 200, publicJob(job));
        }
        for (const file of readdirSync(media).filter((f) =>
          f.startsWith(job.id + '.'),
        ))
          unlinkSync(path.join(media, file));
        jobs.delete(job.id);
        save();
        return send(res, 200, { deleted: true });
      }
      if (req.method === 'GET' && match[2]) {
        if (job.status !== 'completed' || !job.file)
          return send(res, 409, { error: 'This download is not ready.' });
        res.writeHead(200, {
          'Content-Type': job.kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
          'Content-Length': job.size,
          'Content-Disposition': `attachment; filename="orbit-${job.id}.${job.kind === 'audio' ? 'mp3' : 'mp4'}"; filename*=UTF-8''${encodeURIComponent(job.filename)}`,
          'X-Content-Type-Options': 'nosniff',
        });
        createReadStream(path.join(media, job.file)).pipe(res);
        return;
      }
      if (req.method === 'GET') return send(res, 200, publicJob(job));
    }
    send(res, 404, { error: 'Endpoint not found.' });
  } catch (e) {
    if (!res.headersSent)
      send(res, 400, { error: e.message || 'Something went wrong.' });
    else res.end();
  }
});
server.requestTimeout = 10 * 60 * 1000;
server.listen(port, host, () =>
  console.log(`Orbit media engine listening at http://${host}:${port}`),
);
setInterval(() => {
  for (const [id, m] of metadata)
    if (m.expires < Date.now()) metadata.delete(id);
  for (const [id, u] of uploads) {
    if (
      Date.now() - statSync(u.path).mtimeMs > 24 * 60 * 60 * 1000 &&
      running === 0
    ) {
      unlinkSync(u.path);
      uploads.delete(id);
    }
  }
}, 60000).unref();
function shutdown() {
  for (const child of children) child.kill();
  server.close();
  proxy.server.close();
  process.exit();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
