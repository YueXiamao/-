// 行政区划 API
import { api } from './api.js';

export default {
  // 获取省份列表
  getProvinces() {
    return api.get('/api/destinations/provinces');
  },

  // 获取地级市列表（code 作为路径参数）
  getCities(provinceCode) {
    return api.get(`/api/destinations/cities/${provinceCode}`);
  },

  // 获取区县列表（code 作为路径参数）
  getDistricts(cityCode) {
    return api.get(`/api/destinations/districts/${cityCode}`);
  },

  // 搜索目的地
  search(keyword, limit = 10) {
    return api.get('/api/destinations/search', { q: keyword, limit });
  }
};
