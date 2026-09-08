// Integration check against the running companion engine, using an MDN CC0 video.
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:4318/api';
const created = [];
async function api(route, body) {
  const r = await fetch(
    base + route,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
async function wait(job) {
  created.push(job.id);
  for (let i = 0; i < 120; i++) {
    const j = await api('/jobs/' + job.id);
    if (j.status === 'failed') throw new Error(j.error);
    if (j.status === 'completed') {
      assert.ok(j.size > 1000);
      return j;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Job timed out.');
}
try {
  const info = await api('/analyze', {
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  });
  assert.equal(info.hasVideo, true);
  const video = await wait(
    await api('/download', { mediaId: info.id, kind: 'video', height: 'best' }),
  );
  const file = await fetch(base + '/jobs/' + video.id + '/file');
  assert.equal(file.headers.get('content-type'), 'video/mp4');
  const sample = Buffer.from(await file.arrayBuffer());
  assert.ok(sample.includes(Buffer.from('ftyp')));
  console.log('PASS: link analysis → MP4 job → real downloadable MP4');
  const audio = await wait(
    await api('/download', { mediaId: info.id, kind: 'audio', height: 'best' }),
  );
  const audioFile = await fetch(base + '/jobs/' + audio.id + '/file');
  assert.equal(audioFile.headers.get('content-type'), 'audio/mpeg');
  console.log('PASS: source → MP3 audio export');
  const uploaded = await fetch(base + '/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'video/mp4', 'X-File-Name': 'CC0-flower.mp4' },
    body: sample,
  });
  const upload = await uploaded.json();
  assert.ok(uploaded.ok, JSON.stringify(upload));
  assert.ok(upload.width > 0 && upload.height > 0);
  for (const method of ['delogo', 'blur']) {
    const result = await wait(
      await api('/edit', {
        uploadId: upload.id,
        region: { x: 70, y: 75, width: 20, height: 15 },
        method,
      }),
    );
    assert.ok(result.size > 1000);
    console.log('PASS: upload → ' + method + ' processing → MP4 export');
  }
  const bad = await fetch(base + '/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'http://127.0.0.1/private' }),
  });
  assert.equal(bad.status, 400);
  const blocked = await fetch(base + '/jobs', {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(blocked.status, 403);
  console.log('PASS: private destination and untrusted origin blocked');
} finally {
  for (const id of created)
    await fetch(base + '/jobs/' + id, { method: 'DELETE' });
}
