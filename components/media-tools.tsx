'use client';
// The actual tool bodies: MediaResult (quality picker + "add to downloads"
// for a just-analyzed link), JobList/History (the download queue/library),
// Studio (watermark upload + region editor), and Batch (multi-link queue).
// Each of these calls lib/media.ts's `api()` to talk to the engine.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  Clock3,
  FileVideo,
  Film,
  LoaderCircle,
  Music2,
  Play,
  Search,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlatformIcon } from '@/components/studio-shell';
import {
  api,
  bytes,
  duration,
  saveJob,
  type Connection,
  type Job,
  type MediaInfo,
} from '@/lib/media';

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      <CircleAlert size={17} />
      <span>{message}</span>
    </div>
  );
}
export function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label} className="orbit-select">
        <SelectValue>
          {options.find((o) => o.value === value)?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function MediaResult({
  info,
  kind,
  connection,
  onJob,
}: {
  info: MediaInfo;
  kind: string;
  connection: Connection;
  onJob: (j: Job) => void;
}) {
  const [height, setHeight] = useState('best');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true);
    setError('');
    try {
      onJob(
        await api<Job>(connection, '/download', {
          method: 'POST',
          body: JSON.stringify({ mediaId: info.id, kind, height }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="result-card">
      <div className="result-summary">
        <div className="video-thumbnail">
          {info.thumbnail ? (
            <img
              src={info.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Film size={30} />
          )}
          <span>{duration(info.duration)}</span>
        </div>
        <div>
          <span className="detected-source">
            <PlatformIcon platform={info.source} size={16} />
            {info.source}
            <Check size={12} />
          </span>
          <h3>{info.title}</h3>
          <span className="result-meta">
            {info.hasVideo ? 'Video' : 'Audio'} ·{' '}
            {info.heights.length
              ? `${Math.max(...info.heights)}p maximum`
              : 'Source quality'}
          </span>
        </div>
      </div>
      <div className="result-actions">
        <div className="result-options">
          {kind === 'video' ? (
            <Picker
              label="Download quality"
              value={height}
              onChange={setHeight}
              options={[
                { value: 'best', label: 'Best available' },
                ...info.heights.map((h) => ({
                  value: String(h),
                  label: h + 'p',
                })),
              ]}
            />
          ) : (
            <span className="format-pill">
              <Music2 size={14} />
              MP3 · 192 kbps
            </span>
          )}
          <span className="result-meta">
            {kind === 'video'
              ? 'MP4 · video + available audio'
              : info.hasAudio === null
                ? 'Source audio, if present'
                : 'Audio only'}
          </span>
        </div>
        <button
          className="primary-button"
          disabled={
            busy ||
            (kind === 'audio' && info.hasAudio === false) ||
            (kind === 'video' && !info.hasVideo)
          }
          onClick={download}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowDownToLine size={16} />
          )}
          Add to downloads
        </button>
      </div>
      {kind === 'audio' && info.hasAudio === false && (
        <ErrorNotice message="This source has no audio stream." />
      )}
      {error && <ErrorNotice message={error} />}
    </div>
  );
}
export function JobList({
  jobs,
  connection,
  onRefresh,
  compact = false,
}: {
  jobs: Job[];
  connection: Connection;
  onRefresh: () => void;
  compact?: boolean;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  async function save(job: Job) {
    setSaving(job.id);
    setError('');
    try {
      await saveJob(connection, job);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }
  async function remove(job: Job) {
    setError('');
    try {
      await api(connection, `/jobs/${job.id}`, { method: 'DELETE' });
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="job-list">
      {error && <ErrorNotice message={error} />}{' '}
      {(compact ? jobs.slice(0, 3) : jobs).map((job) => (
        <div className="job-row" key={job.id}>
          <span className={'job-icon ' + job.kind}>
            {job.kind === 'audio' ? (
              <Music2 size={20} />
            ) : job.kind === 'watermark' ? (
              <WandSparkles size={20} />
            ) : (
              <Film size={20} />
            )}
          </span>
          <div className="job-info">
            <h3>{job.title}</h3>
            <div className="job-meta">
              <span>{job.kind === 'audio' ? 'MP3' : 'MP4'}</span>
              <span>
                {bytes(job.size) ||
                  new Date(job.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
              </span>
              <span className={'job-status ' + job.status}>
                {job.status === 'processing'
                  ? job.progress >= 89
                    ? 'Converting your file…'
                    : `Processing · ${Math.round(job.progress)}%`
                  : job.status}
              </span>
            </div>
            {['queued', 'processing'].includes(job.status) && (
              <Progress
                className={job.progress >= 89 ? 'progress-converting' : ''}
                aria-label={`${job.title} progress`}
                value={job.status === 'queued' ? 0 : job.progress}
              />
            )}{' '}
            {job.error && <p className="job-error">{job.error}</p>}
          </div>
          {job.status === 'completed' && (
            <button
              className="icon-button save-file"
              title="Save file"
              aria-label={`Save ${job.title}`}
              onClick={() => save(job)}
              disabled={saving === job.id}
            >
              {saving === job.id ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <ArrowDownToLine size={18} />
              )}
            </button>
          )}
          <button
            className="icon-button"
            title={
              ['queued', 'processing'].includes(job.status)
                ? 'Cancel download'
                : 'Delete file and history entry'
            }
            aria-label={
              ['queued', 'processing'].includes(job.status)
                ? `Cancel ${job.title}`
                : `Delete ${job.title}`
            }
            onClick={() => remove(job)}
          >
            {['queued', 'processing'].includes(job.status) ? (
              <X size={16} />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
export function History({
  jobs,
  connection,
  onRefresh,
}: {
  jobs: Job[];
  connection: Connection;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = jobs.filter(
    (j) =>
      (filter === 'all' ||
        (filter === 'active'
          ? ['queued', 'processing'].includes(j.status)
          : j.status === filter)) &&
      j.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="tool-page">
      <div className="tool-heading">
        <span className="panel-icon">
          <Clock3 size={23} />
        </span>
        <h1>
          Your media <span>library.</span>
        </h1>
        <p>
          Follow your queue, save finished files, and revisit recent downloads.
        </p>
      </div>
      <div className="history-toolbar">
        <Tabs value={filter} onValueChange={(v) => setFilter(String(v))}>
          <TabsList className="media-tabs">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">In progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search downloads"
            placeholder="Find a download…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {filtered.length ? (
        <JobList
          jobs={filtered}
          connection={connection}
          onRefresh={onRefresh}
        />
      ) : (
        <div className="tool-empty">
          <ArrowDownToLine size={35} />
          <h3>
            {jobs.length ? 'No matching downloads.' : 'Your orbit is clear.'}
          </h3>
          <p>
            {jobs.length
              ? 'Try another filter or search.'
              : 'Your downloads will appear here as soon as you add one.'}
          </p>
        </div>
      )}
    </section>
  );
}
export function Batch({
  connection,
  onJob,
}: {
  connection: Connection;
  onJob: (j: Job) => void;
}) {
  const [links, setLinks] = useState('');
  const [kind, setKind] = useState('video');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    { url: string; message: string; success: boolean }[]
  >([]);
  const [error, setError] = useState('');
  const stopped = useRef(false);
  useEffect(
    () => () => {
      stopped.current = true;
    },
    [],
  );
  async function start() {
    const list = [
      ...new Set(
        links
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    ];
    if (!list.length || list.length > 10) {
      setError('Add between 1 and 10 links, one per line.');
      return;
    }
    setError('');
    setBusy(true);
    setResults([]);
    stopped.current = false;
    try {
      for (const url of list) {
        if (stopped.current) break;
        try {
          const info = await api<MediaInfo>(connection, '/analyze', {
            method: 'POST',
            body: JSON.stringify({ url }),
          });
          if (stopped.current) break;
          const job = await api<Job>(connection, '/download', {
            method: 'POST',
            body: JSON.stringify({ mediaId: info.id, kind, height: 'best' }),
          });
          onJob(job);
          setResults((r) => [
            ...r,
            { url, message: info.title + ' · added to queue', success: true },
          ]);
        } catch (e) {
          setResults((r) => [
            ...r,
            { url, message: (e as Error).message, success: false },
          ]);
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tool-page">
      <div className="tool-heading">
        <span className="panel-icon">
          <Film size={23} />
        </span>
        <h1>
          Batch <span>downloads.</span>
        </h1>
        <p>One link per line. Up to 10 videos, one organized queue.</p>
      </div>
      <div className="tool-panel">
        <label htmlFor="batch-links" className="field-label">
          Your video links
        </label>
        <textarea
          id="batch-links"
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          disabled={busy}
          placeholder={
            'https://www.youtube.com/watch?v=…\nhttps://vimeo.com/…\nhttps://…'
          }
          rows={7}
        />
        <div className="batch-actions">
          <Picker
            label="Batch format"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'video', label: 'MP4 · best available' },
              { value: 'audio', label: 'MP3 · audio only' },
            ]}
          />
          <button
            className="primary-button"
            onClick={start}
            disabled={busy || !links.trim()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <ArrowDownToLine size={16} />
            )}{' '}
            {busy ? 'Adding to your orbit…' : 'Download batch'}
          </button>
          {busy && (
            <button
              className="text-button"
              onClick={() => {
                stopped.current = true;
              }}
            >
              Stop adding
            </button>
          )}
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="batch-results" aria-live="polite">
          {results.map((r, i) => (
            <div
              key={i}
              className={r.success ? 'batch-success' : 'batch-error'}
            >
              {r.success ? <Check size={15} /> : <CircleAlert size={15} />}
              <div>
                <p>{r.message}</p>
                <small>{r.url}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="tool-footnote">
        Duplicate links are skipped. Two downloads run at a time. Available
        quality varies by source.
      </p>
    </section>
  );
}
type UploadInfo = {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
};
type Region = { x: number; y: number; width: number; height: number };
export function Studio({
  connection,
  onJob,
}: {
  connection: Connection;
  onJob: (j: Job) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [method, setMethod] = useState('delogo');
  const [region, setRegion] = useState<Region>({
    x: 65,
    y: 75,
    width: 25,
    height: 15,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const selection = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      setError('Choose a video file, such as MP4, WebM, or MOV.');
      return;
    }
    if (f.size > 512 * 1024 ** 2) {
      setError('Choose a video smaller than 512 MB.');
      return;
    }
    setError('');
    setInfo(null);
    setFile(f);
  }
  async function process() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const upload =
        info ||
        (await api<UploadInfo>(connection, '/upload', {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: file,
          signal: AbortSignal.timeout(600000),
        }));
      setInfo(upload);
      onJob(
        await api<Job>(connection, '/edit', {
          method: 'POST',
          body: JSON.stringify({ uploadId: upload.id, region, method }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function point(e: React.PointerEvent) {
    const rect = selection.current!.getBoundingClientRect();
    return {
      x: Math.max(
        1,
        Math.min(98, ((e.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.max(
        1,
        Math.min(98, ((e.clientY - rect.top) / rect.height) * 100),
      ),
    };
  }
  return (
    <section className="tool-page">
      <div className="tool-heading">
        <span className="panel-icon">
          <WandSparkles size={23} />
        </span>
        <h1>
          Watermark <span>studio.</span>
        </h1>
        <p>
          Select the watermark in your own video and choose how to clean it up.
        </p>
      </div>
      <div className="studio-layout">
        <div className="tool-panel studio-main">
          {!file ? (
            <button
              className={'upload-zone ' + (dragOver ? 'drag-over' : '')}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                choose(e.dataTransfer.files[0]);
              }}
            >
              <span className="upload-icon">
                <Upload size={28} />
              </span>
              <h3>Drop your video into orbit.</h3>
              <p>or click to choose a file</p>
              <span className="format-pill">MP4, MOV, WebM · up to 512 MB</span>
            </button>
          ) : (
            <>
              <div className="file-heading">
                <FileVideo size={18} />
                <span>{file.name}</span>
                <button
                  disabled={busy}
                  className="icon-button"
                  aria-label="Choose another video"
                  onClick={() => input.current?.click()}
                >
                  <Upload size={17} />
                </button>
              </div>
              <div className="video-edit-frame">
                <video
                  ref={video}
                  src={preview}
                  playsInline
                  preload="metadata"
                />
                <div
                  ref={selection}
                  className="selection-surface"
                  aria-label="Drag to select watermark region"
                  onPointerDown={(e) => {
                    start.current = point(e);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!start.current) return;
                    const p = point(e);
                    setRegion({
                      x: Math.min(p.x, start.current.x),
                      y: Math.min(p.y, start.current.y),
                      width: Math.max(1, Math.abs(p.x - start.current.x)),
                      height: Math.max(1, Math.abs(p.y - start.current.y)),
                    });
                  }}
                  onPointerUp={() => {
                    start.current = null;
                  }}
                  onPointerCancel={() => {
                    start.current = null;
                  }}
                >
                  <div
                    className="selection-box"
                    style={{
                      left: region.x + '%',
                      top: region.y + '%',
                      width: region.width + '%',
                      height: region.height + '%',
                    }}
                  >
                    <span>Watermark</span>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
              <div className="video-controls">
                <button
                  className="text-button"
                  onClick={() =>
                    video.current?.paused
                      ? video.current.play()
                      : video.current?.pause()
                  }
                >
                  <Play size={14} />
                  Play / pause
                </button>
                <input
                  aria-label="Preview position"
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="0"
                  onChange={(e) => {
                    if (
                      video.current &&
                      Number.isFinite(video.current.duration)
                    )
                      video.current.currentTime =
                        (video.current.duration * Number(e.target.value)) / 100;
                  }}
                />
              </div>
              <p className="tool-footnote">
                Drag a box around the watermark, or enter its position on the
                right. The exported video applies the edit to every frame.
              </p>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </div>
        <aside className="tool-panel studio-settings">
          <h3>Fine-tune your frame</h3>
          <label className="field-label">Cleanup method</label>
          <Picker
            label="Cleanup method"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'delogo', label: 'Blend surrounding pixels' },
              { value: 'blur', label: 'Soft blur' },
            ]}
          />
          <p className="tool-footnote">
            {method === 'delogo'
              ? 'Best for small, static watermarks over simple backgrounds. This blends pixels; it does not recover the original image.'
              : 'Apply a soft blur to the selected area while keeping the rest of the frame intact.'}
          </p>
          <span className="field-label">Selection · percent of frame</span>
          <div className="region-grid">
            {(['x', 'y', 'width', 'height'] as const).map((k) => (
              <label key={k}>
                {{ x: 'Left', y: 'Top', width: 'Width', height: 'Height' }[k]}
                <div>
                  <input
                    type="number"
                    min="1"
                    max="97"
                    value={Math.round(region[k] * 10) / 10}
                    onChange={(e) => {
                      const v = Math.max(
                        1,
                        Math.min(97, Number(e.target.value) || 1),
                      );
                      setRegion((r) => ({ ...r, [k]: v }));
                    }}
                  />
                  %
                </div>
              </label>
            ))}
          </div>
          <button
            disabled={!file || busy}
            className="primary-button"
            onClick={process}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <WandSparkles size={16} />
            )}{' '}
            {busy ? 'Sending to studio…' : 'Clean & export MP4'}
          </button>
          <span className="tool-footnote">
            Audio is preserved. Preview the exported result in your downloads.
          </span>
        </aside>
      </div>
      {error && <ErrorNotice message={error} />}
    </section>
  );
}
