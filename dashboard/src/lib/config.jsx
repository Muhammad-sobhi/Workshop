export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '8080') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return window.location.origin;
  }
  return '';
}
