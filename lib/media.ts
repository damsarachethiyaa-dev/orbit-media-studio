// Shared types and helpers for talking to the Orbit media engine (server/index.mjs)
// from the website. `api()` is the one function every request goes through.

export type MediaInfo = {
  id: string;
  url: string;
  title: string;
  source: string;
  duration: number;
  thumbnail: string | null;
  heights: number[];
  hasAudio: boolean | null;
  hasVideo: boolean;
};
export type Job = {
  id: string;
  title: string;
  kind: 'video' | 'audio' | 'watermark';
  status:
    | 'queued'
    | 'processing'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'expired';
  progress: number;
  createdAt: string;
  size?: number;
  filename?: string;
  error?: string;
};
export type Connection = { url: string; key: string };
// Points at the hosted engine by default so visitors don't have to configure
// anything. Anyone can still switch to their own engine in Preferences.
// The URL/key come from build-time env vars (set in `.env.local`, which is
// git-ignored) rather than being hardcoded here, so the deployment's engine
// key never lives in the repository's source or history.
export const connectionDefault: Connection = {
  url: import.meta.env.VITE_ORBIT_ENGINE_URL || 'http://127.0.0.1:4318',
  key: import.meta.env.VITE_ORBIT_ENGINE_KEY || '',
};
export async function api<T>(
  connection: Connection,
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  let response;
  try {
    response = await fetch(
      connection.url.replace(/\/$/, '') + '/api' + endpoint,
      {
        ...init,
        headers: {
          ...(typeof init.body === 'string'
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(connection.key
            ? { Authorization: 'Bearer ' + connection.key }
            : {}),
          ...init.headers,
        },
        signal:
          init.signal ||
          AbortSignal.timeout(endpoint === '/analyze' ? 95000 : 30000),
      },
    );
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new Error(
      'Your media engine is not reachable. Open Preferences to connect it, then try again.',
    );
  }
  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ error: 'The media engine returned an error.' }))) as {
      error?: string;
    };
    throw new Error(error.error || 'Request failed.');
  }
  return response.json();
}
export function detectSource(value: string) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const h = url.hostname.toLowerCase();
    const match = (d: string) => h === d || h.endsWith('.' + d);
    if (match('youtube.com') || match('youtu.be')) return 'YouTube';
    if (match('tiktok.com')) return 'TikTok';
    if (match('instagram.com')) return 'Instagram';
    if (match('twitter.com') || match('x.com')) return 'Twitter / X';
    if (match('vimeo.com')) return 'Vimeo';
    if (match('facebook.com') || match('fb.watch')) return 'Facebook';
    if (match('twitch.tv')) return 'Twitch';
    if (match('reddit.com') || match('redd.it')) return 'Reddit';
    if (match('pinterest.com') || match('pin.it')) return 'Pinterest';
    if (match('soundcloud.com')) return 'SoundCloud';
    if (match('dailymotion.com') || match('dai.ly')) return 'Dailymotion';
    if (/\.(mp4|webm|mov|m4v|mkv|mp3|m4a|m3u8)$/i.test(url.pathname))
      return 'Direct media';
    return h.replace(/^www\./, '');
  } catch {
    return null;
  }
}
// Sources verified to fail from this deployment every time, so the app can
// say so immediately instead of sending a request that is certain to fail.
// Each was confirmed by testing against the live engine:
//   youtube  - blocks datacenter/VPS IP ranges outright
//   reddit   - same; its session endpoint returns 403 from this IP
//   vimeo    - now requires a signed-in session for virtually every video
// Fixing any of these needs an account's cookies or a residential proxy,
// neither of which this deployment uses. Returns null for supported hosts.
const unsupportedHosts: [string[], string][] = [
  [['youtube.com', 'youtu.be'], 'YouTube'],
  [['reddit.com', 'redd.it'], 'Reddit'],
  [['vimeo.com'], 'Vimeo'],
];
export function unsupportedSource(value: string) {
  try {
    const h = new URL(value).hostname.toLowerCase();
    for (const [domains, name] of unsupportedHosts)
      if (domains.some((d) => h === d || h.endsWith('.' + d)))
        return `${name} downloads are unavailable right now. TikTok, Instagram, X, Facebook, Twitch, Pinterest, SoundCloud and Dailymotion all still work.`;
    return null;
  } catch {
    return null;
  }
}
export function duration(seconds: number) {
  if (!seconds) return 'Duration unavailable';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function bytes(value?: number) {
  if (!value) return '';
  return value >= 1024 ** 3
    ? (value / 1024 ** 3).toFixed(1) + ' GB'
    : (value / 1024 ** 2).toFixed(1) + ' MB';
}
// `share` opens the device's native share sheet, which on a phone is the
// only route into the photo gallery -- a web page cannot write there
// directly. It requires a user gesture, so pass it for taps on Save and
// leave it off for automatic saves, which fall back to a file download.
export async function saveJob(connection: Connection, job: Job, share = false) {
  const r = await fetch(
    `${connection.url.replace(/\/$/, '')}/api/jobs/${job.id}/file`,
    {
      headers: connection.key
        ? { Authorization: 'Bearer ' + connection.key }
        : {},
    },
  );
  if (!r.ok) throw new Error('This file is no longer available.');
  const blob = await r.blob();
  const name = job.filename || 'orbit-download.mp4';
  if (share && typeof navigator.canShare === 'function') {
    const file = new File([blob], name, {
      type: blob.type || 'application/octet-stream',
    });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: job.title });
        return;
      } catch (e) {
        // Dismissing the sheet is a normal outcome, not a failure.
        if ((e as Error).name === 'AbortError') return;
        // Anything else (unsupported target, etc.) falls back to a download.
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
