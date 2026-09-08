import type { Connection, Job } from './media';

// Fetch separately from sharing: a slow transfer must not consume the tap
// needed to open the native share sheet.
export async function prepareJob(
  connection: Connection,
  job: Job,
): Promise<File> {
  const response = await fetch(
    `${connection.url.replace(/\/$/, '')}/api/jobs/${job.id}/file`,
    {
      headers: connection.key
        ? { Authorization: 'Bearer ' + connection.key }
        : {},
    },
  );
  if (!response.ok) throw new Error('This file is no longer available.');
  const blob = await response.blob();
  return new File(
    [blob],
    job.filename || `orbit-download.${job.kind === 'audio' ? 'mp3' : 'mp4'}`,
    {
      type: blob.type || (job.kind === 'audio' ? 'audio/mpeg' : 'video/mp4'),
    },
  );
}
export function canShareFile(file: File) {
  return (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// Call directly from the prepared file's Share button, without awaiting I/O.
export async function shareFile(file: File, title: string) {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (error) {
    if ((error as Error).name === 'AbortError') return 'cancelled';
    throw new Error(
      'Sharing is unavailable. Use Download file to save it instead.',
    );
  }
}
export async function saveJob(connection: Connection, job: Job) {
  downloadFile(await prepareJob(connection, job));
}
