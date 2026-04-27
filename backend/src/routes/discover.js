/**
 * 随机玩推荐路由
 * POST /api/discover/recommend
 */
import { getRecommendations } from '../services/discoverService.js';

export default async function discoverRoutes(fastify) {
  fastify.post('/recommend', async (request, reply) => {
    const { current_location, days, budget, preferences } = request.body || {};

    if (!preferences || !Array.isArray(preferences)) {
      return reply.code(400).send({ error: 'preferences is required and must be an array' });
    }

    try {
      const recommendations = await getRecommendations({
        current_location,
        days: parseInt(days) || 2,
        budget: budget || '1000-2000',
        preferences,
      });

      return { success: true, data: { recommendations }, ts: Date.now() };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: '推荐服务异常', details: err.message });
    }
  });
}
