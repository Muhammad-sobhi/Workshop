// Shrinks photos (iPhone HEIC/JPEG, large PNG screenshots) to a JPEG before upload,
// so they stay well under the server's upload size limit.
// Non-image files (e.g. PDF) and images the browser can't decode are returned unchanged.

const MAX_DIMENSION = 1920;
const QUALITY = 0.85;
const SKIP_BELOW_BYTES = 500 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

export async function compressImage(file) {
  if (!file || !file.type?.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name || '')) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size <= SKIP_BELOW_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; // transparent PNG areas become white instead of black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) return file;

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
