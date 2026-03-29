import axios from 'axios';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;
export const BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('company');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Users
export const usersAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Expenses
export const expensesAPI = {
  list: (params) => api.get('/expenses', { params }),
  stats: () => api.get('/expenses/stats'),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'lines') {
        formData.append(key, JSON.stringify(data[key]));
      } else if (key === 'receipt' && data[key]) {
        formData.append(key, data[key]);
      } else if (data[key] !== undefined && data[key] !== null) {
        formData.append(key, data[key]);
      }
    });
    return api.post('/expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Approvals
export const approvalsAPI = {
  list: () => api.get('/approvals'),
  approve: (recordId, data) => api.post(`/approvals/${recordId}/approve`, data),
  reject: (recordId, data) => api.post(`/approvals/${recordId}/reject`, data),
  overrideExpense: (expenseId, data) => api.post(`/approvals/expenses/${expenseId}/override`, data),
};

// Workflows
export const workflowsAPI = {
  list: () => api.get('/workflows'),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.put(`/workflows/${id}`, data),
  delete: (id) => api.delete(`/workflows/${id}`),
};

// Currencies
export const currenciesAPI = {
  countries: () => api.get('/currencies/countries'),
  rates: (base) => api.get(`/currencies/rates/${base}`),
};

export default api;
