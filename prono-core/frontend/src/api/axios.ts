import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle auth failures
// - 401 always means missing/invalid JWT → redirect to login
// - 403 with no stored token means Spring Security returned 403 instead of 401
//   (Http403ForbiddenEntryPoint default in Spring Security 6) → same treatment
// - 403 with a stored token means the user IS authenticated but lacks the role
//   (e.g. non-admin calling an admin endpoint) → do NOT redirect, let the caller handle it
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hasToken = !!localStorage.getItem('token');
    if (status === 401 || (status === 403 && !hasToken)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
