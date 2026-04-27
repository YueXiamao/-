// 行政区划 API
import { api } from './api.js';
import { getLocalCities, getLocalDistricts, getLocalProvinces } from '../constants/region-data.js';

async function withLocalFallback(request, fallback) {
  try {
    const result = await request();
    return Array.isArray(result) && result.length > 0 ? result : fallback();
  } catch (error) {
    return fallback();
  }
}

export function createDestinationsService(apiClient = api) {
  return {
    // 获取省份列表
    getProvinces() {
      return withLocalFallback(
        () => apiClient.get('/api/destinations/provinces', undefined, { silent: true }),
        getLocalProvinces
      );
    },

    // 获取地级市列表（code 作为路径参数）
    getCities(provinceCode) {
      return withLocalFallback(
        () => apiClient.get(`/api/destinations/cities/${provinceCode}`, undefined, { silent: true }),
        () => getLocalCities(provinceCode)
      );
    },

    // 获取区县列表（code 作为路径参数）
    getDistricts(cityCode) {
      return withLocalFallback(
        () => apiClient.get(`/api/destinations/districts/${cityCode}`, undefined, { silent: true }),
        () => getLocalDistricts(cityCode)
      );
    },

    // 搜索目的地
    search(keyword, limit = 10) {
      return apiClient.get('/api/destinations/search', { q: keyword, limit });
    }
  };
}

export default createDestinationsService();
