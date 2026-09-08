import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// Compile the actual browser helper without booting a browser or bundler.
const compiled = ts.transpileModule(
  readFileSync(new URL('../lib/files.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const { prepareJob, canShareFile, shareFile } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
function mockNavigator(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
  t.after(() => Object.defineProperty(globalThis, 'navigator', descriptor));
}

test('preparing a file never invokes sharing; the subsequent tap shares synchronously', async (t) => {
  let shareCalls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response('video bytes', {
      headers: { 'Content-Type': 'video/mp4' },
    });
  });
  mockNavigator(t, {
    canShare: ({ files }) => files[0] instanceof File,
    share: async ({ files }) => {
      shareCalls++;
      assert.equal(files[0].name, 'example.mp4');
    },
  });
  const file = await prepareJob(
    { url: 'https://engine.example', key: 'test-key' },
    {
      id: 'example',
      filename: 'example.mp4',
      kind: 'video',
    },
  );
  assert.equal(shareCalls, 0);
  assert.equal(canShareFile(file), true);
  const completion = shareFile(file, 'Example');
  assert.equal(shareCalls, 1);
  assert.equal(await completion, 'shared');
});

test('share dismissal is distinct from failure and does not start a download', async (t) => {
  mockNavigator(t, {
    share: async () => {
      throw new DOMException('Dismissed', 'AbortError');
    },
  });
  const file = new File(['sample'], 'sample.mp4');
  assert.equal(await shareFile(file, 'Sample'), 'cancelled');
  mockNavigator(t, {
    share: async () => {
      throw new DOMException('Blocked', 'NotAllowedError');
    },
  });
  await assert.rejects(shareFile(file, 'Sample'), /Use Download file/);
});

test('expired files report an error before offering a share', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 404 }),
  );
  await assert.rejects(
    prepareJob({ url: 'https://engine.example', key: '' }, { id: 'gone' }),
    /no longer available/,
  );
});
