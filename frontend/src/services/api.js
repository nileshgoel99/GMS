import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => axios.post(`${API_BASE_URL}/token/`, credentials),
  refresh: (refresh) => axios.post(`${API_BASE_URL}/token/refresh/`, { refresh }),
};

export const companyAPI = {
  getProfile: () => api.get('/company/profile/'),
  updateProfile: (data) => api.patch('/company/profile/', data),
};

export const customersAPI = {
  getAll: (params) => api.get('/customers/', { params }),
  getById: (id) => api.get(`/customers/${id}/`),
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}/`, data),
  delete: (id) => api.delete(`/customers/${id}/`),
};

export const ordersAPI = {
  getAll: (params) => api.get('/orders/pi/', { params }),
  getById: (id) => api.get(`/orders/pi/${id}/`),
  create: (data) => api.post('/orders/pi/', data),
  update: (id, data) => api.put(`/orders/pi/${id}/`, data),
  delete: (id) => api.delete(`/orders/pi/${id}/`),
  getPlanningSheet: (id) => api.get(`/orders/pi/${id}/planning_sheet/`),
  updatePlanningSheet: (id, data) => api.post(`/orders/pi/${id}/planning_sheet/`, data),
  getStatistics: () => api.get('/orders/pi/statistics/'),
  downloadPiPdf: (id) =>
    api.get(`/orders/pi/${id}/pdf/`, { responseType: 'blob' }).then((res) => res.data),

  getIntents: (params) => api.get('/orders/intents/', { params }),
  getIntent: (id) => api.get(`/orders/intents/${id}/`),
  createIntent: (data) => api.post('/orders/intents/', data),
  updateIntent: (id, data) => api.put(`/orders/intents/${id}/`, data),
  deleteIntent: (id) => api.delete(`/orders/intents/${id}/`),
  uploadIntentAttachment: (id, formData) => api.post(`/orders/intents/${id}/attachments/`, formData),
};

export const inventoryAPI = {
  getAll: (params) => api.get('/inventory/items/', { params }),
  getById: (id) => api.get(`/inventory/items/${id}/`),
  create: (data) => api.post('/inventory/items/', data),
  update: (id, data) => api.put(`/inventory/items/${id}/`, data),
  delete: (id) => api.delete(`/inventory/items/${id}/`),
  getLowStock: () => api.get('/inventory/items/low_stock/'),
  getSummary: (id) => api.get(`/inventory/items/${id}/summary/`),
  getStatistics: () => api.get('/inventory/items/statistics/'),
  
  getLogs: (params) => api.get('/inventory/logs/', { params }),
  createLog: (data) => api.post('/inventory/logs/', data),
};

export const procurementAPI = {
  getAll: (params) => api.get('/procurement/po/', { params }),
  getById: (id) => api.get(`/procurement/po/${id}/`),
  create: (data) => api.post('/procurement/po/', data),
  update: (id, data) => api.put(`/procurement/po/${id}/`, data),
  delete: (id) => api.delete(`/procurement/po/${id}/`),
  addItem: (id, data) => api.post(`/procurement/po/${id}/add_item/`, data),
  getPending: () => api.get('/procurement/po/pending/'),
  getStatistics: () => api.get('/procurement/po/statistics/'),
  
  getReceipts: (params) => api.get('/procurement/receipts/', { params }),
  createReceipt: (data) => api.post('/procurement/receipts/', data),
};

export const productionAPI = {
  getAll: (params) => api.get('/production/issues/', { params }),
  getById: (id) => api.get(`/production/issues/${id}/`),
  create: (data) => api.post('/production/issues/', data),
  update: (id, data) => api.put(`/production/issues/${id}/`, data),
  delete: (id) => api.delete(`/production/issues/${id}/`),
  issueMaterials: (id) => api.post(`/production/issues/${id}/issue_materials/`),
  getStatistics: () => api.get('/production/issues/statistics/'),
  
  getReturns: (params) => api.get('/production/returns/', { params }),
  createReturn: (data) => api.post('/production/returns/', data),
};

export default api;
