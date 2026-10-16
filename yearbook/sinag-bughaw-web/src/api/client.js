import axios from 'axios';

const STORAGE_ROOT     = import.meta.env.VITE_APP_URL             || 'http://127.0.0.1:8000';

function apiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.port === '8000') {
    return '/api';
  }
  return import.meta.env.VITE_API_URL || '/api';
}

const BASE_URL = apiBaseUrl();
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

export function storageUrl(path) {
  if (!path) return null;

  // Already a full Cloudinary or any http URL — return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Reconstruct Cloudinary URL from stored public_id / relative path
  if (CLOUDINARY_CLOUD) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${path}`;
  }

  // Last resort fallback local storage (development only)
  return `${STORAGE_ROOT}/storage/${path}`;
}

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('sb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers?.set === 'function') {
      config.headers.set('Content-Type', false);
    } else {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl = String(err.config?.url ?? '');
    const isAuthAttempt = /\/auth\/(login|register|otp|forgot-password|reset-password|face-login)/.test(requestUrl);

    if (err.response?.status === 503 && err.response?.data?.code === 'MAINTENANCE') {
      if (!window.location.pathname.startsWith('/maintenance')) {
        window.location.assign('/maintenance');
      }
      return Promise.reject(err);
    }
    const isViewPing = /\/analytics\/record-(view|content-view)/.test(requestUrl);
    if (err.response?.status === 401 && !isAuthAttempt && !isViewPing) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('sb_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
