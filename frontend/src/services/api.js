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
  me: () => api.get('/accounts/me/'),
  updateMe: (data) => api.patch('/accounts/me/', data),
};

export const accountsAPI = {
  getUsers: (params) => api.get('/accounts/users/', { params }),
  createUser: (data) => api.post('/accounts/users/', data),
  updateUser: (id, data) => api.patch(`/accounts/users/${id}/`, data),
  getRoles: (params) => api.get('/accounts/roles/', { params }),
  createRole: (data) => api.post('/accounts/roles/', data),
  updateRole: (id, data) => api.patch(`/accounts/roles/${id}/`, data),
  deleteRole: (id) => api.delete(`/accounts/roles/${id}/`),
  getModules: () => api.get('/accounts/modules/'),
};

export const companyAPI = {
  getProfile: () => api.get('/company/profile/'),
  updateProfile: (data) => api.patch('/company/profile/', data),
  getCurrencyBanks: () => api.get('/company/currency-banks/'),
  createCurrencyBank: (data) => api.post('/company/currency-banks/', data),
  updateCurrencyBank: (id, data) => api.put(`/company/currency-banks/${id}/`, data),
  deleteCurrencyBank: (id) => api.delete(`/company/currency-banks/${id}/`),
};

export const customersAPI = {
  getAll: (params) => api.get('/customers/', { params }),
  getById: (id) => api.get(`/customers/${id}/`),
  lookupCode: (code, excludeId) =>
    api.get('/customers/lookup-code/', { params: { code, exclude_id: excludeId || undefined } }),
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}/`, data),
  delete: (id) => api.delete(`/customers/${id}/`),
};

export const suppliersAPI = {
  getAll: (params) => api.get('/suppliers/', { params }),
  getById: (id) => api.get(`/suppliers/${id}/`),
  create: (data) => api.post('/suppliers/', data),
  update: (id, data) => api.put(`/suppliers/${id}/`, data),
  delete: (id) => api.delete(`/suppliers/${id}/`),
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
  getBuyerPOPaymentDueSummary: () => api.get('/orders/buyer-pos/payment-due-summary/'),
  downloadPiPdf: (id) =>
    api.get(`/orders/pi/${id}/pdf/`, { responseType: 'blob' }).then((res) => res.data),


  getBuyerPOs: (params) => api.get('/orders/buyer-pos/', { params }),
  getBuyerPO: (id) => api.get(`/orders/buyer-pos/${id}/`),
  createBuyerPO: (data) => api.post('/orders/buyer-pos/', data),
  updateBuyerPO: (id, data) => api.put(`/orders/buyer-pos/${id}/`, data),
  deleteBuyerPO: (id) => api.delete(`/orders/buyer-pos/${id}/`),
  getItemCatalogue: (customerId) => api.get('/orders/buyer-pos/item-catalogue/', { params: customerId ? { customer: customerId } : {} }),
  uploadPoDocument: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/orders/buyer-pos/${id}/upload-document/`, form);
  },
  removePoDocument: (id) => api.delete(`/orders/buyer-pos/${id}/remove-document/`),
  getNextPiRef: () => api.get('/orders/buyer-pos/next-pi-ref/'),
  savePiRef: (id, piRef) => api.patch(`/orders/buyer-pos/${id}/save-pi-ref/`, { pi_ref: piRef }),
  createPiFromBuyerPo: (id, data) => api.post(`/orders/buyer-pos/${id}/create-pi/`, data),

  getPIs: (params) => api.get('/orders/pi/', { params }),
  getPI: (id) => api.get(`/orders/pi/${id}/`),
  patchPI: (id, data) => api.patch(`/orders/pi/${id}/`, data),
  deletePI: (id) => api.delete(`/orders/pi/${id}/`),

  // Trims Library
  getTrimsMaster: (params) => api.get('/orders/trims-master/', { params }),
  createTrim: (data) => api.post('/orders/trims-master/', data),
  updateTrim: (id, data) => api.patch(`/orders/trims-master/${id}/`, data),
  deleteTrim: (id) => api.delete(`/orders/trims-master/${id}/`),

  // Indents
  getIndents: (params) => api.get('/orders/indents/', { params }),
  getIndent: (id) => api.get(`/orders/indents/${id}/`),
  createIndent: (data) => api.post('/orders/indents/', data),
  updateIndent: (id, data) => api.patch(`/orders/indents/${id}/`, data),
  deleteIndent: (id) => api.delete(`/orders/indents/${id}/`),
  getNextIndentNumber: () => api.get('/orders/indents/next-number/'),
  getIndentTemplate: (itemName) => api.get('/orders/indents/template/', { params: { item_name: itemName } }),
  getIndentPiOptions: (params) => api.get('/orders/indents/pi-options/', { params }),
  getIndentPiContext: (piId) => api.get('/orders/indents/pi-context/', { params: { pi: piId } }),
  getIndentTrimsLibrary: (params) => api.get('/orders/indents/trims-library/', { params }),

  // Indent templates (read-only)
  getIndentTemplates: (params) => api.get('/orders/indent-templates/', { params }),
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
  getPayablesDueSummary: () => api.get('/procurement/po/payment-due-summary/'),
  getNextPoNumber: () => api.get('/procurement/po/next-po-number/'),
  
  getReceipts: (params) => api.get('/procurement/receipts/', { params }),
  createReceipt: (data) => api.post('/procurement/receipts/', data),
};

export const purchaseBillAPI = {
  getAll: (params) => api.get('/procurement/bills/', { params }),
  getById: (id) => api.get(`/procurement/bills/${id}/`),
  create: (data) => api.post('/procurement/bills/', data),
  update: (id, data) => api.put(`/procurement/bills/${id}/`, data),
  delete: (id) => api.delete(`/procurement/bills/${id}/`),
  getNextRef: () => api.get('/procurement/bills/next-ref/'),
  getPayablesDueSummary: () => api.get('/procurement/bills/payment-due-summary/'),
  prefillFromPo: (poId) => api.get('/procurement/bills/prefill-from-po/', { params: { po_id: poId } }),
};

export const salesEntryAPI = {
  getAll: (params) => api.get('/orders/sales/', { params }),
  getById: (id) => api.get(`/orders/sales/${id}/`),
  create: (data) => api.post('/orders/sales/', data),
  update: (id, data) => api.put(`/orders/sales/${id}/`, data),
  delete: (id) => api.delete(`/orders/sales/${id}/`),
  getNextRef: () => api.get('/orders/sales/next-ref/'),
  getReceivablesSummary: () => api.get('/orders/sales/payment-due-summary/'),
  prefillFromBuyerPo: (poId) => api.get('/orders/sales/prefill-from-buyer-po/', { params: { po_id: poId } }),
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
