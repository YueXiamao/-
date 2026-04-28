// 位置相关路由
import { locationService } from '../services/locationService.js';

// 统一响应格式
function ok(data) {
  return { code: 0, message: 'success', data };
}

function fail(code, message) {
  return { code, message };
}

export default async function locationRoutes(fastify) {
  // 逆地理编码：经纬度 → 省市区
  fastify.post('/regeo', async (req) => {
    const { latitude, longitude } = req.body || {};

    if (latitude == null || longitude == null) {
      return fail(20001, '缺少经纬度参数');
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < 1 || lng < 1) {
      return fail(20001, '经纬度无效');
    }

    try {
      const result = await locationService.reverseGeocode(lat, lng);
      return ok(result);
    } catch (err) {
      fastify.log.error('逆地理编码失败:', err.message);
      return fail(20001, '位置识别失败，请手动选择');
    }
  });
}
