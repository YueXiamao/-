// POI 路由
import Fastify from 'fastify';
import { poiService } from '../services/poiService.js';

const router = Fastify();

// 搜索 POI
router.post('/search', async (request, reply) => {
  const { keyword, type, city, limit = 10 } = request.body;

  if (!keyword || !type || !city) {
    return reply.status(400).send({ code: 10001, message: 'keyword, type, city 必填' });
  }

  if (!['spot', 'food', 'hotel'].includes(type)) {
    return reply.status(400).send({ code: 10001, message: 'type 必须是 spot/food/hotel' });
  }

  const pois = await poiService.search({ keyword, type, city, limit: parseInt(limit) });
  return { code: 0, data: pois };
});

export default router;
