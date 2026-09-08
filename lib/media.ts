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
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (connection.key && !headers.has('Authorization'))
    headers.set('Authorization', 'Bearer ' + connection.key);
  let response;
  try {
    response = await fetch(
      connection.url.replace(/\/$/, '') + '/api' + endpoint,
      {
        ...init,
        headers,
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
export {
  prepareJob,
  canShareFile,
  downloadFile,
  shareFile,
  saveJob,
} from './files';
