const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 350 * 1024;

/**
 * Resize large photos and re-encode them as JPEG so uploads drop camera metadata
 * and send a much smaller file. Videos, GIFs, and already-small files are unchanged.
 */
export async function compressImageFile(file) {
  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size < SKIP_BELOW_BYTES) return file;
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const alreadySmallJpeg = scale === 1 && file.type === 'image/jpeg' && file.size < 1.2 * 1024 * 1024;
    if (alreadySmallJpeg) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}
