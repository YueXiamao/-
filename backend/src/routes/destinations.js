// 行政区划路由
import { destinationService } from '../services/destinationService.js';

export default async function destinationRoutes(fastify) {
  // 获取省份列表
  fastify.get('/provinces', async () => {
    return destinationService.getProvinces();
  });

  // 获取地级市
  fastify.get('/cities/:provinceCode', async (req) => {
    const { provinceCode } = req.params;
    return destinationService.getCities(provinceCode);
  });

  // 获取区县
  fastify.get('/districts/:cityCode', async (req) => {
    const { cityCode } = req.params;
    return destinationService.getDistricts(cityCode);
  });

  // 搜索目的地
  fastify.get('/search', async (req) => {
    const { keyword, limit } = req.query;
    return destinationService.search(keyword || '', parseInt(limit) || 10);
  });

  // 热门目的地
  fastify.get('/hot', async (req) => {
    const { limit } = req.query;
    return destinationService.getHotDestinations(parseInt(limit) || 20);
  });
}
