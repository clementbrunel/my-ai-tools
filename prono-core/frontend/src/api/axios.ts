import axios from 'axios';
import { LocalStorageService, StorageKey } from '@/utils/localStorage';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = LocalStorageService.getString(StorageKey.Token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: 401 = session expired / invalid token → back to login
// Auth endpoints handle their own 401s (wrong credentials, unverified email, etc.)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      LocalStorageService.remove(StorageKey.Token);
      LocalStorageService.remove(StorageKey.User);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
