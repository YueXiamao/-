import { api } from './api.js';
import defaultRegionStore from './region-db.js';

function normalizeSearchResult(item, regionStore) {
  const code = String(item.code || '');
  // 从 region-db 推断 level: 9位 = 区县, 6位 = 城市
  let level = item.level || (code.length === 9 ? 'district' : 'city');

  if (level === 'district') {
    // 从本地数据库反查所属城市和省份
    const city = regionStore.getCityByDistrictCode(code);
    const province = city ? regionStore.getProvincesByCityCode(city.code) : null;
    return {
      ...item,
      level,
      province: province?.name || item.province || '',
      city: city?.name || item.city || ''
    };
  }

  // city 级别
  const province = item.province ? { name: item.province } : null;
  return {
    ...item,
    level,
    province: province?.name || item.province || '',
    city: item.city || item.name
  };
}

export function createDestinationsService(apiClient = api, options = {}) {
  const regionStore = options.regionStore || defaultRegionStore;

  return {
    async getProvinces() {
      return regionStore.getProvinces();
    },

    async getCities(provinceCode) {
      return regionStore.getCities(provinceCode);
    },

    async getDistricts(cityCode) {
      return regionStore.getDistricts(cityCode);
    },

    async search(keyword, limit = 10) {
      const results = await apiClient.get('/api/destinations/search', { q: keyword, limit });
      return (results || []).map(item => normalizeSearchResult(item, regionStore));
    }
  };
}

export default createDestinationsService();
