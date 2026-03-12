import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh/`, { refresh });
          localStorage.setItem('access', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch (_) {
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login/', { email, password }),
  register: (body) => api.post('/auth/register/', body),
  me: () => api.get('/auth/me/'),
  updateProfile: (data) => api.patch('/auth/me/', data),
};

export const owner = {
  apply: (body) => api.post('/owner/apply/', body),
  applicationStatus: () => api.get('/owner/application-status/'),
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/owner/upload/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  requestAudit: () => api.post('/audits/owner/request/'),
};

export const admin = {
  listApplications: () => api.get('/admin/owner-applications/'),
  getApplication: (id) => api.get(`/admin/owner-applications/${id}/`),
  approve: (id, review_notes = '') => api.patch(`/admin/owner-applications/${id}/approve/`, { review_notes }),
  reject: (id, review_notes = '') => api.patch(`/admin/owner-applications/${id}/reject/`, { review_notes }),
  pendingWork: () => api.get('/admin/pending-work/'),
  acceptWork: (restaurantId) => api.post(`/admin/accept-work/${restaurantId}/`),
  evidence: {
    pending: (params = {}) => api.get('/evidence/pending/', { params }),
    byRestaurant: (restaurantId, params = {}) =>
      api.get(`/restaurants/${restaurantId}/evidence/`, { params }),
    approve: (id, body = {}) => api.post(`/evidence/${id}/approve/`, body),
    reject: (id, body) => api.post(`/evidence/${id}/reject/`, body),
    flag: (id, body) => api.post(`/evidence/${id}/flag/`, body),
  },
  scores: {
    submit: (body) => api.post('/score/submit/', body),
    rubric: () => api.get('/rubric/categories/'),
  },
};

export const restaurants = {
  list: (params = {}) => api.get('/restaurants/', { params }),
  get: (id) => api.get(`/restaurants/${id}/`),
  getScore: (id) => api.get(`/restaurants/${id}/score/`),
  me: () => api.get('/restaurants/me/'),
  updateMe: (data) => api.patch('/restaurants/me/', data),
  addPhoto: (data) => api.post('/restaurants/me/photos/', data),
  deletePhoto: (id) => api.delete(`/restaurants/me/photos/${id}/`),
};

export const evidence = {
  upload: (formData) => api.post('/evidence/upload/', formData),
  listMine: (params = {}) => api.get('/evidence/my-restaurant/', { params }),
  delete: (id) => api.delete(`/evidence/${id}/`),
};

export const rubric = {
  categories: () => api.get('/rubric/categories/'),
};

export const scores = {
  myRestaurant: () => api.get('/score/my-restaurant/'),
};

export const superadmin = {
  listUsers: (params = {}) => api.get('/superadmin/users/', { params }),
  getUser: (id) => api.get(`/superadmin/users/${id}/`),
  updateUser: (id, data) => api.patch(`/superadmin/users/${id}/`, data),
  createUser: (data) => api.post('/superadmin/users/create/', data),
  logs: () => api.get('/superadmin/logs/'),
  rollbackRestaurant: (restaurantId) => api.post(`/superadmin/rollback-restaurant/${restaurantId}/`),
  report: (restaurantId) => api.get(`/superadmin/report/${restaurantId}/`),
  staffWorkload: (params = {}) => api.get('/superadmin/staff-workload/', { params }),
  unassignedWork: () => api.get('/superadmin/unassigned-work/'),
  assignWork: (restaurantId, userId) => api.post('/superadmin/assign-work/', { restaurant_id: restaurantId, user_id: userId }),
  listEvidence: (params = {}) => api.get('/evidence/pending/', { params }),
  getEvidence: (id) => api.get(`/evidence/${id}/detail/`),
  evidenceSummary: () => api.get('/superadmin/evidence-summary/'),
};

export const crypto = {
  verifyChain: (restaurantId) => api.post(`/crypto/verify-chain/${restaurantId}/`),
  integrityCheck: (evidenceId) => api.get(`/crypto/integrity-check/${evidenceId}/`),
  merkleProof: (evidenceId) => api.get(`/crypto/merkle-proof/${evidenceId}/`),
  verifyTimestamp: (evidenceId) => api.post(`/crypto/verify-timestamp/${evidenceId}/`),
};

// audit APIs removed: audits are no longer supported
