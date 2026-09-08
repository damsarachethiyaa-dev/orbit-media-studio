const errorTranslations = [
  [
    /DRM protected|DRM-protected|DRM protection/i,
    'This source only offered protected streams for the requested format. Choose an unprotected video or use the source’s own download option.',
  ],
  [
    /not a bot|sign in to confirm/i,
    'This source is blocking downloads from this server right now. Other videos may still work; try again later or try a different link.',
  ],
  [
    /only works when logged-in|login required|authentication required|sign in to watch/i,
    'This source requires a valid signed-in session. Ask the server owner to connect or refresh the source session.',
  ],
  [
    /HTTP Error 403|403 Forbidden|blocked.*IP|IP.*blocked/i,
    'This source refused the server connection. A valid source session may be required; the server network may also be blocked.',
  ],
  [
    /use.*cookies|authentication/i,
    'The source session is missing or expired. Ask the server owner to connect or refresh this source.',
  ],
  [
    /Cannot parse data|Unable to extract/i,
    'The source returned a page the downloader could not read. Try the original video link; a source session or extractor update may be needed.',
  ],
  [
    /private video|members-only|join this channel/i,
    'This video is private or restricted to members, so it cannot be downloaded.',
  ],
  [
    // Anchor 404 to an HTTP status: yt-dlp prefixes errors with the video
    // id, and numeric ids (TikTok, Facebook) routinely contain "404".
    /video unavailable|has been removed|no longer available|HTTP Error 404|\b404 Not Found\b/i,
    'This video is unavailable. It may have been removed, or the link may be wrong.',
  ],
  [
    /\bage[- ]restricted\b|\bage verification\b|confirm your age|verify your age/i,
    'This video is age-restricted and cannot be downloaded without a signed-in account.',
  ],
  [
    // "geo" alone would match any id or channel name containing it.
    /geo[- ]?(restricted|blocked|restriction)|not available in your country|blocked it in your country/i,
    'This video is not available in the region where this server is located.',
  ],
  [
    /live event|is live/i,
    'Live streams cannot be downloaded. Try again once the stream has ended.',
  ],
];
export function friendlyError(raw) {
  for (const [pattern, message] of errorTranslations)
    if (pattern.test(raw)) return message;
  return raw;
}
