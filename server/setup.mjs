import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
const win = process.platform === 'win32';
const python = path.resolve('.venv', win ? 'Scripts/python.exe' : 'bin/python');
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) process.exit(r.status || 1);
}
run(process.env.PYTHON || (win ? 'python' : 'python3'), [
  '-m',
  'venv',
  '.venv',
]);
run(python, ['-m', 'pip', 'install', '-r', 'server/requirements.txt']);
const r = spawnSync(
  python,
  ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
  { encoding: 'utf8', windowsHide: true },
);
if (r.status !== 0) throw new Error('FFmpeg setup failed');
mkdirSync('.tools', { recursive: true });
const dest = path.resolve('.tools', win ? 'ffmpeg.exe' : 'ffmpeg');
copyFileSync(r.stdout.trim(), dest);
if (!win) chmodSync(dest, 0o755);
console.log('Orbit media engine is ready. Run npm run dev:full.');
