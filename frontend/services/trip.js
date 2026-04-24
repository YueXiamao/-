import { api } from './api.js';

export default {
  generate(params) {
    return api.post('/api/trip/generate', params);
  },

  save(params) {
    return api.post('/api/trip/save', params);
  },

  list(params = {}) {
    return api.get('/api/trip/list', params);
  },

  detail(tripId) {
    return api.get(`/api/trip/${tripId}`);
  },

  updateItem(tripId, itemId, data) {
    return api.patch(`/api/trip/${tripId}/item/${itemId}`, data);
  },

  reorderItem(tripId, itemId, direction) {
    return api.patch(`/api/trip/${tripId}/item/${itemId}/reorder`, { direction });
  },

  replaceItem(tripId, itemId) {
    return api.post(`/api/trip/${tripId}/item/${itemId}/replace`);
  },

  deleteItem(tripId, itemId) {
    return api.delete(`/api/trip/${tripId}/item/${itemId}`);
  },

  delete(tripId) {
    return api.delete(`/api/trip/${tripId}`);
  },

  export(tripId) {
    return api.get(`/api/trip/${tripId}/export`);
  }
};
