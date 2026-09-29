import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Auth uses Laravel Sanctum's HttpOnly session cookie; axios sends the
// XSRF-TOKEN cookie back as the X-XSRF-TOKEN header automatically.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401: not logged in. 419: CSRF token mismatch, i.e. the session expired.
    const status = error.response?.status;
    if ((status === 401 || status === 419) && typeof window !== 'undefined') {
      localStorage.removeItem('erp-storage');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    if (API_BASE_URL.startsWith('http')) {
      return API_BASE_URL.replace(/\/api\/?$/, '');
    }
    return window.location.origin;
  }
  return '';
}

export default apiClient;

// Fetches the CSRF cookie; must be called before login.
export function getCsrfCookie() {
  return apiClient.get('/sanctum/csrf-cookie');
}
