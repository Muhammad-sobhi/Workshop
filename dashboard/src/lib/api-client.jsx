import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  let token = null;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('erp-storage');
    if (raw) {
      try { token = JSON.parse(raw).state?.token; } catch {}
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
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
