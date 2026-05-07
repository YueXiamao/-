// 位置服务：逆地理编码（经纬度 → 省市区）
// 使用原生 https 避免 WSL 全局代理影响
import https from 'https';

class LocationService {
  async reverseGeocode(lat, lng) {
    const { config } = await import('../config/index.js');
    const key = config.amap?.key;

    if (!key) {
      throw new Error('高德地图 API Key 未配置');
    }

    const location = `${lng},${lat}`;
    const params = new URLSearchParams({
      key,
      location,
      extensions: 'base',
      output: 'JSON',
    });

    const url = `https://restapi.amap.com/v3/geocode/regeo?${params}`;

    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      }).on('error', reject).setTimeout(8000, function() {
        this.destroy();
        reject(new Error('请求超时'));
      });
    });

    const resp = JSON.parse(data);

    if (resp.status !== '1') {
      throw new Error(resp.info || '逆地理编码失败');
    }

    const comp = resp.regeocode?.addressComponent || {};
    const rawCity = Array.isArray(comp.city) ? comp.city[0] || comp.province : (comp.city || comp.province);
    return {
      province: comp.province || '',
      city: rawCity,
      district: comp.district || '',
      formatted_address: resp.regeocode?.formatted_address || '',
    };
  }
}

export const locationService = new LocationService();
