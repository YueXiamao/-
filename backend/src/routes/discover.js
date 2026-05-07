/**
 * 随机玩推荐路由
 * POST /api/discover/recommend
 * POST /api/discover/random (alias)
 * POST /api/discover/:destination/trip  — 一键从发现页生成行程
 */
import { getRecommendations } from '../services/discoverService.js';
import { tripService } from '../services/tripService.js';
import { ok } from '../utils/response.js';
import { Errors } from '../middleware/errorHandler.js';

export default async function discoverRoutes(fastify) {

  const handler = async (request) => {
    const { current_location, days, budget, preferences } = request.body || {};
    const openid = request.headers['x-openid'] || '';

    if (!preferences || !Array.isArray(preferences)) {
      throw Errors.VALIDATION_ERROR('缺少 preferences 参数，必须是数组');
    }

    const recommendations = await getRecommendations({
      current_location,
      days: parseInt(days) || 2,
      budget: budget || '1000-2000',
      preferences,
      openid,  // 用于偏好学习加权
    });

    return ok({ recommendations }, 'success');
  };

  fastify.post('/recommend', handler);
  fastify.post('/random', handler); // alias for backward compatibility

  // 一键从目的地生成行程（发现页「生成行程」按钮）
  fastify.post('/:destination/trip', async (req) => {
    const { destination } = req.params;
    const { days, start_date, preferences, extra_notes } = req.body || {};

    if (!destination || typeof destination !== 'string') {
      throw Errors.VALIDATION_ERROR('缺少 destination 参数');
    }

    const trip = await tripService.generate({
      destinations: [{ name: destination, city: destination, level: 'city' }],
      start_date: start_date || new Date().toISOString().slice(0, 10),
      days: parseInt(days) || 2,
      preferences: preferences || [],
      extra_notes: extra_notes || '',
    });

    return ok(trip);
  });
}
