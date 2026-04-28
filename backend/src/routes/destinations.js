// 行政区划路由
import { destinationService } from '../services/destinationService.js';
import { ok } from '../utils/response.js';

export default async function destinationRoutes(fastify) {
  // 获取省份列表
  fastify.get('/provinces', async () => {
    return ok(await destinationService.getProvinces());
  });

  // 获取地级市
  fastify.get('/cities/:provinceCode', async (req) => {
    const { provinceCode } = req.params;
    return ok(await destinationService.getCities(provinceCode));
  });

  // 获取区县
  fastify.get('/districts/:cityCode', async (req) => {
    const { cityCode } = req.params;
    return ok(await destinationService.getDistricts(cityCode));
  });

  // 搜索目的地
  fastify.get('/search', async (req) => {
    const { q, keyword, limit } = req.query;
    return ok(await destinationService.search(q || keyword || '', parseInt(limit) || 10));
  });

  // 热门目的地
  fastify.get('/hot', async (req) => {
    const { limit } = req.query;
    return ok(await destinationService.getHotDestinations(parseInt(limit) || 20));
  });
}
