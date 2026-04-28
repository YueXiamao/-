/**
 * 随机玩推荐路由
 * POST /api/discover/recommend
 * POST /api/discover/random (alias)
 */
import { getRecommendations } from '../services/discoverService.js';
import { ok } from '../utils/response.js';

export default async function discoverRoutes(fastify) {

  const handler = async (request) => {
    const { current_location, days, budget, preferences } = request.body || {};

    if (!preferences || !Array.isArray(preferences)) {
      return { code: 10001, message: '缺少 preferences 参数，必须是数组' };
    }

    try {
      const recommendations = await getRecommendations({
        current_location,
        days: parseInt(days) || 2,
        budget: budget || '1000-2000',
        preferences,
      });

      return ok({ recommendations }, 'success');
    } catch (err) {
      request.log.error(err);
      return { code: 50001, message: '推荐服务异常', data: null };
    }
  };

  fastify.post('/recommend', handler);
  fastify.post('/random', handler); // alias for backward compatibility
}
