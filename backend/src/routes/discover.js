// 随机玩路由
import Fastify from 'fastify';
import { discoverService } from '../services/discoverService.js';

const router = Fastify();

// 推荐目的地
router.post('/recommend', async (request, reply) => {
  const { current_location, days, budget, preferences } = request.body;

  if (!current_location || !days || !budget) {
    return reply.status(400).send({ code: 10001, message: 'current_location, days, budget 必填' });
  }

  const recommendations = await discoverService.recommend({ current_location, days, budget, preferences });
  return { code: 0, data: recommendations };
});

// 获取推荐目的地详情（转为行程规划）
router.post('/:destination_name/trip', async (request, reply) => {
  const { destination_name } = request.params;
  const { days, preferences, start_date } = request.body;

  const trip = await discoverService.generateTripForDestination({
    destination_name,
    days: days || 2,
    preferences: preferences || [],
    start_date: start_date || new Date().toISOString().split('T')[0]
  });

  return { code: 0, data: trip };
});

export default router;
