// 位置服务：逆地理编码（经纬度 → 省市区）
import axios from 'axios';

class LocationService {
  async reverseGeocode(lat, lng) {
    const { config } = await import('../config/index.js');
    const key = config.amap?.key;

    if (!key) {
      throw new Error('高德地图 API Key 未配置');
    }

    const url = 'https://restapi.amap.com/v3/geocode/regeo';
    const params = {
      key,
      location: `${lng},${lat}`,
      extensions: 'base',
      output: 'JSON',
    };

    const resp = await axios.get(url, { params, timeout: 8000 });

    if (resp.status !== 200 || resp.data?.status !== '1') {
      throw new Error(resp.data?.info || '逆地理编码失败');
    }

    const comp = resp.data.regeocode?.addressComponent || {};
    // 直辖市city字段可能为空数组或空字符串，用province兜底
    const rawCity = Array.isArray(comp.city) ? comp.city[0] || comp.province : (comp.city || comp.province);
    return {
      province: comp.province || '',
      city: rawCity,
      district: comp.district || '',
      formatted_address: resp.data.regeocode?.formatted_address || '',
    };
  }
}

export const locationService = new LocationService();
