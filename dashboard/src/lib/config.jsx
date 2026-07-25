export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api$/, '');
}
