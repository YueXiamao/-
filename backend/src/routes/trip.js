import { tripService } from '../services/tripService.js';
import { preferenceLearningService } from '../services/preferenceLearning.js';
import { Errors } from '../middleware/errorHandler.js';

export default async function tripRoutes(fastify) {
  fastify.post('/generate', async (req) => {
    // Total timeout: if generation takes >20s, return fallback immediately
    const timeoutMs = 20000;
    const timeoutErr = new Error(`generation timeout after ${timeoutMs}ms`);
    timeoutErr.code = 'GENERATION_TIMEOUT';

    const race = Promise.race([
      tripService.generate(req.body || {}),
      new Promise((_, reject) => setTimeout(() => reject(timeoutErr), timeoutMs))
    ]);

    try {
      return await race;
    } catch (err) {
      if (err.code === 'GENERATION_TIMEOUT') {
        console.warn('[trip/generate] timeout, using fallback template');
        const { FallbackTemplateProvider } = await import(
          '../services/trip-generation/fallbackTemplateProvider.js'
        );
        const req2 = req.body || {};
        const provider = new FallbackTemplateProvider();
        return provider.provide(
          {
            destinations: req2.destinations || [],
            days: req2.days || 2,
            start_date: req2.start_date || new Date().toISOString().slice(0, 10),
            preferences: req2.preferences || []
          },
          { reason: `generation_timeout_after_${timeoutMs}ms` }
        );
      }
      throw err;
    }
  });

  fastify.post('/save', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.saveTrip(openid, req.body);
  });

  fastify.get('/list', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { page, page_size, source } = req.query;
    return tripService.getTripList(openid, { page, page_size, source });
  });

  fastify.get('/:tripId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const trip = tripService.getTripDetail(openid, req.params.tripId);
    if (!trip) throw Errors.NOT_FOUND('行程不存在');
    return trip;
  });

  fastify.get('/:tripId/export', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.exportTrip(openid, req.params.tripId);
  });

  fastify.delete('/:tripId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.deleteTrip(openid, req.params.tripId);
  });

  fastify.patch('/:tripId/item/:itemId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { notes } = req.body || {};
    return tripService.updateTripItemNote(openid, req.params.tripId, req.params.itemId, notes);
  });

  fastify.patch('/:tripId/item/:itemId/reorder', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { direction } = req.body || {};
    return tripService.reorderTripItem(openid, req.params.tripId, req.params.itemId, direction);
  });

  fastify.post('/:tripId/item/:itemId/replace', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { intent } = req.body || {};
    return tripService.replaceTripItem(openid, req.params.tripId, req.params.itemId, { intent });
  });

  fastify.delete('/:tripId/item/:itemId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.deleteTripItem(openid, req.params.tripId, req.params.itemId);
  });

  fastify.post('/:tripId/feedback', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { type, payload } = req.body || {};
    const result = tripService.recordFeedback(openid, req.params.tripId, type);

    // 从负反馈中学习用户偏好（异步，不阻塞响应）
    if (result.success && openid) {
      preferenceLearningService.inferFromFeedback(openid, type, payload || {});
    }

    return result;
  });
}
