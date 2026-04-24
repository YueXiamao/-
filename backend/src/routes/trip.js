import { tripService } from '../services/tripService.js';
import { Errors } from '../middleware/errorHandler.js';

export default async function tripRoutes(fastify) {
  fastify.post('/generate', async (req) => {
    return tripService.generate(req.body || {});
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
    return tripService.replaceTripItem(openid, req.params.tripId, req.params.itemId);
  });

  fastify.delete('/:tripId/item/:itemId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.deleteTripItem(openid, req.params.tripId, req.params.itemId);
  });
}
