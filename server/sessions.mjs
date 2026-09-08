import { existsSync } from 'node:fs';
import path from 'node:path';

// Sessions are supplied by the operator outside the repository. Each extractor
// gets a temporary copy, so parallel jobs cannot overwrite the original jar.
export function sessionFileFor(value, env) {
  const host = new URL(value).hostname;
  const sources = [
    ['youtube', ['youtube.com', 'youtu.be']],
    ['vimeo', ['vimeo.com']],
    ['reddit', ['reddit.com', 'redd.it']],
    ['facebook', ['facebook.com', 'fb.watch']],
    ['instagram', ['instagram.com']],
    ['tiktok', ['tiktok.com']],
    ['twitter', ['twitter.com', 'x.com']],
  ];
  const source = sources.find(([, domains]) =>
    domains.some((domain) => host === domain || host.endsWith('.' + domain)),
  )?.[0];
  if (source && env.ORBIT_COOKIES_DIR) {
    const candidate = path.resolve(env.ORBIT_COOKIES_DIR, source + '.txt');
    if (existsSync(candidate)) return candidate;
  }
  if (!env.ORBIT_COOKIES_FILE) return null;
  const fallback = path.resolve(env.ORBIT_COOKIES_FILE);
  if (!existsSync(fallback))
    throw new Error(
      'The configured source session file is missing. Ask the server owner to reconnect the source.',
    );
  return fallback;
}
