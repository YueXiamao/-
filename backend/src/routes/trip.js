// 行程路由
import { tripService } from '../services/tripService.js';
import { AppError } from '../middleware/errorHandler.js';

export default async function tripRoutes(fastify) {
  // 生成行程
  fastify.post('/generate', async (req) => {
    const { destinations, start_date, days, preferences, extra_notes } = req.body || {};
    if (!destinations || !start_date || !days) {
      return reply.code(400).send({ error: '缺少必填参数' });
    }
    return tripService.generate({ destinations, start_date, days, preferences, extra_notes });
  });

  // 保存行程
  fastify.post('/save', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.saveTrip(openid, req.body);
  });

  // 行程列表
  fastify.get('/list', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { page, page_size, source } = req.query;
    return tripService.getTripList(openid, { page, page_size, source });
  });

  // 行程详情
  fastify.get('/:tripId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const trip = tripService.getTripDetail(openid, req.params.tripId);
    if (!trip) throw AppError.NOT_FOUND('行程不存在');
    return trip;
  });

  // 删除行程
  fastify.delete('/:tripId', async (req) => {
    const openid = req.headers['x-openid'] || '';
    return tripService.deleteTrip(openid, req.params.tripId);
  });

  // 更新备注
  fastify.patch('/item/:itemId/notes', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { notes } = req.body || {};
    return tripService.updateTripItemNote(openid, req.params.itemId, notes);
  });
}
