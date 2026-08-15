export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function getImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return '';
  if (imagePath.startsWith('data:') || imagePath.startsWith('blob:')) {
    return imagePath;
  }

  let cleanPath = imagePath;

  // Strip any hardcoded localhost/127.0.0.1 domain from cached or database stored values
  if (cleanPath.includes('localhost') || cleanPath.includes('127.0.0.1')) {
    cleanPath = cleanPath.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
  }

  // If it's an external URL (e.g. Cloudinary, AWS S3, etc.), return as-is
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }

  cleanPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return cleanPath;
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmedBase}${cleanPath}`;
}

