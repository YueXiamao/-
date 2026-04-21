// 行程 API
import { api } from './api.js';

export default {
  // 生成行程
  generate(params) {
    return api.post('/api/trip/generate', params);
  },

  // 保存行程
  save(params) {
    return api.post('/api/trip/save', params);
  },

  // 获取行程列表
  list(params = {}) {
    return api.get('/api/trip/list', params);
  },

  // 获取行程详情
  detail(tripId) {
    return api.get(`/api/trip/${tripId}`);
  },

  // 更新行程单项
  updateItem(tripId, itemId, data) {
    return api.patch(`/api/trip/${tripId}/item/${itemId}`, data);
  },

  // 删除行程
  delete(tripId) {
    return api.delete(`/api/trip/${tripId}`);
  },

  // 导出行程
  export(tripId) {
    return api.get(`/api/trip/${tripId}/export`);
  }
};
