import { api } from './api.js';
import defaultRegionStore from './region-db.js';

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

    search(keyword, limit = 10) {
      return apiClient.get('/api/destinations/search', { q: keyword, limit });
    }
  };
}

export default createDestinationsService();
