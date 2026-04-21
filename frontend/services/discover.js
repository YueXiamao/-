// 随机玩 API
import { api } from './api.js';

export default {
  // 推荐目的地
  recommend(params) {
    return api.post('/api/discover/recommend', params);
  },

  // 获取目的地详情行程
  getDestinationTrip(destinationName, params) {
    return api.post(`/api/discover/${destinationName}/trip`, params);
  }
};
