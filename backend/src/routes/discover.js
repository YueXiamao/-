// 随机玩路由
import { discoverService } from '../services/discoverService.js';
import { tripService } from '../services/tripService.js';
import { Errors } from '../middleware/errorHandler.js';

export default async function discoverRoutes(fastify) {
  fastify.post('/recommend', async (req) => {
    const { current_location, days, budget, preferences } = req.body || {};
    if (!current_location || !days || !budget) {
      throw Errors.VALIDATION_ERROR('缺少必填参数');
    }
    return discoverService.recommend({ current_location, days, budget, preferences });
  });

  fastify.post('/:destinationName/trip', async (req) => {
    const destinationName = decodeURIComponent(req.params.destinationName || '');
    const { days = 2, start_date, preferences = [], extra_notes = '' } = req.body || {};
    if (!destinationName) throw Errors.VALIDATION_ERROR('缺少目的地参数');

    const startDate = start_date || new Date().toISOString().split('T')[0];
    return tripService.generate({
      destinations: [{ name: destinationName, city: destinationName, province: '' }],
      start_date: startDate,
      days: parseInt(days) || 2,
      preferences,
      extra_notes
    });
  });
}
