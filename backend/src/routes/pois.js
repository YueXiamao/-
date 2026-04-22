// POI 路由
import { poiService } from '../services/poiService.js';

export default async function poiRoutes(fastify) {
  // 搜索 POI
  fastify.post('/search', async (req) => {
    const { keyword, type, city, limit } = req.query;
    const pois = await poiService.search({
      keyword: keyword || '',
      type: type || 'spot',
      city: city || '',
      limit: parseInt(limit) || 10
    });
    if (pois.length > 0) {
      poiService.cachePois(pois);
    }
    return pois;
  });

  // POI 详情
  fastify.get('/detail/:gaodeId', async (req) => {
    return poiService.getDetail(req.params.gaodeId);
  });

  // 热门 POI（从缓存）
  fastify.get('/hot', async (req) => {
    const { city, type, limit } = req.query;
    return poiService.getCachedPois(city || '', type || 'spot', parseInt(limit) || 20);
  });
}
