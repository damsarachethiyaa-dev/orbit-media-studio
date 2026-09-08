import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError } from './errors.mjs';

test('webpage and storage errors are not mistaken for age restrictions', () => {
  for (const raw of [
    'ERROR: Unable to download webpage: HTTP Error 403: Forbidden',
    'ERROR: Unexpected response from webpage request',
    'ERROR: Not enough storage space',
  ])
    assert.doesNotMatch(friendlyError(raw), /age-restricted/);
});

test('specific age, authentication, unavailable and regional failures stay actionable', () => {
  assert.match(
    friendlyError('ERROR: This video is age-restricted'),
    /age-restricted/,
  );
  assert.match(
    friendlyError('ERROR: Please confirm your age'),
    /signed-in account/,
  );
  assert.match(
    friendlyError('ERROR: The web client only works when logged-in'),
    /signed-in session/,
  );
  assert.match(
    friendlyError('ERROR: This video has been removed'),
    /unavailable/,
  );
  assert.match(friendlyError('ERROR: not available in your country'), /region/);
  assert.match(friendlyError('ERROR: geo-restricted content'), /region/);
});

test('ids containing digits or words used by patterns are not misread', () => {
  // yt-dlp prefixes every error with the video id, so an id is matched
  // against each pattern too. Numeric ids routinely contain "404", and
  // channel names can contain "geo".
  assert.doesNotMatch(
    friendlyError('ERROR: [tiktok] 7404123456789: Unable to download webpage'),
    /removed/,
  );
  assert.doesNotMatch(
    friendlyError('ERROR: [youtube] geoNews1234: Unable to download webpage'),
    /region/,
  );
  // A real HTTP 404 must still be reported as unavailable.
  assert.match(
    friendlyError('ERROR: Unable to download webpage: HTTP Error 404'),
    /unavailable/,
  );
});
