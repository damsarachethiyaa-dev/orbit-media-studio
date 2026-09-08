/** Normalize alternate public page URLs without changing other hosts.
 * @param {string} value
 */
export function normalizeMediaUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (host === 'facebook.com' || host.endsWith('.facebook.com')) {
    const match = url.pathname.match(/\/videos\/(?:[^/]+\/)?(\d+)\/?$/);
    const videoId =
      match?.[1] ||
      (url.pathname === '/video.php' ? url.searchParams.get('v') : null);
    if (
      videoId &&
      /^\d+$/.test(videoId) &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['http:', 'https:'].includes(url.protocol)
    ) {
      return `https://www.facebook.com/watch/?v=${videoId}`;
    }
  }
  return url.href;
}
/** Public Vimeo embeds can remain playable when the landing page needs login.
 * Preserve unlisted tokens provided by the user; never invent credentials.
 * @param {string} value
 */
export function vimeoPlayerUrl(value) {
  const url = new URL(value);
  if (!['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/(\d+)(?:\/([a-fA-F0-9]+))?\/?$/);
  if (!match) return null;
  const player = new URL(`https://player.vimeo.com/video/${match[1]}`);
  const token = url.searchParams.get('h') || match[2];
  if (token) player.searchParams.set('h', token);
  return player.href;
}
