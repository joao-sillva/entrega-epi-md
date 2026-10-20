import { FILE_MIME_TYPES } from '../config/constants.js';

export const DOWNLOAD_DECLINED = 'declined';

/**
 * Saves a file for the user.
 *
 * Inside Claude artifacts the host `downloads` capability is used; everywhere
 * else a temporary link triggers the browser download.
 * Returns `true` on success or `DOWNLOAD_DECLINED` when the user refused.
 */
export async function saveFile(fileName, data, mimeType = 'application/octet-stream') {
  if (typeof claude !== 'undefined') {
    try {
      const downloads = await claude.use('downloads');
      if (downloads) {
        await downloads.save({ filename: fileName, data });
        return true;
      }
    } catch (error) {
      if (error && error.code === 'declined') return DOWNLOAD_DECLINED;
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  return true;
}

export const saveJsonFile = (fileName, text) => saveFile(fileName, text, FILE_MIME_TYPES.json);
