// 随机玩路由
import { discoverService } from '../services/discoverService.js';

export default async function discoverRoutes(fastify) {
  fastify.post('/recommend', async (req) => {
    const { current_location, days, budget, preferences } = req.body || {};
    if (!current_location || !days || !budget) {
      return reply.code(400).send({ error: '缺少必填参数' });
    }
    return discoverService.recommend({ current_location, days, budget, preferences });
  });
}
