// 位置服务：经纬度 → 省市区（调后端 /api/location/regeo）
import { api } from './api.js';

export const locationApi = {
  // 逆地理编码
  reverseGeocode(lat, lng) {
    return api.post('/api/location/regeo', { latitude: lat, longitude: lng });
  }
};
