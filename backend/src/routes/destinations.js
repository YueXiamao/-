// 行政区划路由
import Fastify from 'fastify';
import { destinationService } from '../services/destinationService.js';

const router = Fastify();

// 获取省份列表
router.get('/provinces', async (request, reply) => {
  const provinces = await destinationService.getProvinces();
  return { code: 0, data: provinces };
});

// 获取地级市列表
router.get('/cities', async (request, reply) => {
  const { province_code } = request.query;
  if (!province_code) {
    return reply.status(400).send({ code: 10001, message: 'province_code 不能为空' });
  }
  const cities = await destinationService.getCities(province_code);
  return { code: 0, data: cities };
});

// 获取区县列表
router.get('/districts', async (request, reply) => {
  const { city_code } = request.query;
  if (!city_code) {
    return reply.status(400).send({ code: 10001, message: 'city_code 不能为空' });
  }
  const districts = await destinationService.getDistricts(city_code);
  return { code: 0, data: districts };
});

// 搜索目的地
router.get('/search', async (request, reply) => {
  const { q, limit = 10 } = request.query;
  if (!q || q.length < 2) {
    return reply.status(400).send({ code: 10001, message: '搜索关键词至少2个字' });
  }
  const results = await destinationService.search(q, parseInt(limit));
  return { code: 0, data: results };
});

export default router;
