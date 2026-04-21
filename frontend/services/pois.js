// POI API
import { api } from './api.js';

export default {
  // 搜索 POI
  search({ keyword, type, city, limit = 10 }) {
    return api.post('/api/pois/search', { keyword, type, city, limit });
  }
};
