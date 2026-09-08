import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMediaUrl, vimeoPlayerUrl } from '../lib/sources.mjs';

test('Facebook alternate video paths normalize to the same watch ID', () => {
  for (const input of [
    'https://www.facebook.com/creator/videos/123456789/',
    'https://m.facebook.com/creator/videos/title/123456789/',
    'https://facebook.com/video.php?v=123456789&ref=share',
  ])
    assert.equal(
      normalizeMediaUrl(input),
      'https://www.facebook.com/watch/?v=123456789',
    );
});
test('other sources, credentials, custom ports and lookalike hosts are unchanged', () => {
  for (const input of [
    'https://youtube.com/watch?v=example',
    'https://reddit.com/r/test/',
    'https://facebook.com.example.com/user/videos/123/',
    'https://user:pass@facebook.com/user/videos/123/',
    'https://facebook.com:8000/user/videos/123/',
    'https://facebook.com/reel/123/',
  ])
    assert.equal(normalizeMediaUrl(input), new URL(input).href);
});
test('Vimeo public player fallback retains supplied unlisted tokens', () => {
  assert.equal(
    vimeoPlayerUrl('https://vimeo.com/76979871'),
    'https://player.vimeo.com/video/76979871',
  );
  assert.equal(
    vimeoPlayerUrl('https://vimeo.com/123/abc123'),
    'https://player.vimeo.com/video/123?h=abc123',
  );
  assert.equal(
    vimeoPlayerUrl('https://vimeo.com/123?h=def456'),
    'https://player.vimeo.com/video/123?h=def456',
  );
  for (const input of [
    'https://player.vimeo.com/video/123',
    'https://vimeo.com/showcase/123',
    'https://vimeo.com.example.com/123',
  ])
    assert.equal(vimeoPlayerUrl(input), null);
});
