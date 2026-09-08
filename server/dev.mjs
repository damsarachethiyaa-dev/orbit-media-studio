import { spawn } from 'node:child_process';
const engineUrl = `http://127.0.0.1:${process.env.ORBIT_PORT || 4318}/api/health`;
let existing = false;
try {
  const r = await fetch(engineUrl, {
    signal: AbortSignal.timeout(2000),
    headers: process.env.ORBIT_API_KEY
      ? { Authorization: 'Bearer ' + process.env.ORBIT_API_KEY }
      : {},
  });
  const data = await r.json();
  existing = r.ok && data.ok && data.name === 'Orbit media engine';
} catch {}
const children = [];
if (existing)
  console.log('Using the Orbit engine already running on this computer.');
else
  children.push(
    spawn(process.execPath, ['server/index.mjs'], {
      stdio: 'inherit',
      windowsHide: true,
    }),
  );
children.push(
  spawn(process.execPath, ['node_modules/vinext/dist/cli.js', 'dev'], {
    stdio: 'inherit',
    windowsHide: true,
  }),
);
for (const child of children)
  child.on('exit', () => {
    for (const p of children) p.kill();
  });
process.on('SIGINT', () => {
  for (const child of children) child.kill();
});
