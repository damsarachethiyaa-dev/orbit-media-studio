import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sessionFileFor } from './sessions.mjs';

test('session selection uses exact source domains and a configured fallback', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'orbit-session-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const youtube = path.join(directory, 'youtube.txt');
  const fallback = path.join(directory, 'default.txt');
  writeFileSync(youtube, '# Netscape HTTP Cookie File\n');
  writeFileSync(fallback, '# Netscape HTTP Cookie File\n');
  const env = { ORBIT_COOKIES_DIR: directory, ORBIT_COOKIES_FILE: fallback };
  assert.equal(
    sessionFileFor('https://m.youtube.com/watch?v=test', env),
    youtube,
  );
  assert.equal(sessionFileFor('https://youtu.be/test', env), youtube);
  assert.equal(
    sessionFileFor('https://youtube.com.example.com/', env),
    fallback,
  );
  assert.equal(sessionFileFor('https://vimeo.com/123', env), fallback);
  assert.equal(
    sessionFileFor('https://reddit.com/', { ORBIT_COOKIES_DIR: directory }),
    null,
  );
  assert.throws(
    () =>
      sessionFileFor('https://vimeo.com/', {
        ORBIT_COOKIES_FILE: path.join(directory, 'missing.txt'),
      }),
    /session file is missing/,
  );
});
