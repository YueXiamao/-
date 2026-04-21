// 行程路由
import Fastify from 'fastify';
import { tripService } from '../services/tripService.js';
import { userService } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Fastify();

// 生成行程
router.post('/generate', async (request, reply) => {
  const { destinations, start_date, days, preferences, extra_notes } = request.body;

  if (!destinations || destinations.length === 0) {
    throw AppError.VALIDATION_ERROR('目的地不能为空');
  }
  if (!start_date) {
    throw AppError.VALIDATION_ERROR('出发日期不能为空');
  }
  if (!days || days < 1 || days > 14) {
    throw AppError.VALIDATION_ERROR('天数必须在1-14之间');
  }
  if (!preferences || preferences.length === 0) {
    throw AppError.VALIDATION_ERROR('游玩方式至少选一项');
  }

  // 记录用户偏好（异步，不阻塞生成）
  const openid = request.headers['x-openid'];
  if (openid) {
    userService.recordPreference(openid, { destinations, preferences, extra_notes }).catch(() => {});
  }

  const trip = await tripService.generate({ destinations, start_date, days, preferences, extra_notes });
  return { code: 0, data: trip };
});

// 保存行程
router.post('/save', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const trip = await tripService.saveTrip(openid, request.body);
  return { code: 0, data: trip };
});

// 获取行程列表
router.get('/list', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const { source, page = 1, page_size = 10 } = request.query;
  const trips = await tripService.getTripList(openid, { source, page: parseInt(page), page_size: parseInt(page_size) });
  return { code: 0, data: trips };
});

// 获取行程详情
router.get('/:trip_id', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const { trip_id } = request.params;
  const trip = await tripService.getTripDetail(openid, trip_id);
  if (!trip) {
    throw AppError.NOT_FOUND('行程不存在');
  }
  return { code: 0, data: trip };
});

// 更新行程单项
router.patch('/:trip_id/item/:item_id', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const { trip_id, item_id } = request.params;
  const result = await tripService.updateTripItem(openid, trip_id, item_id, request.body);
  return { code: 0, data: result };
});

// 删除行程
router.delete('/:trip_id', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const { trip_id } = request.params;
  await tripService.deleteTrip(openid, trip_id);
  return { code: 0, message: '删除成功' };
});

// 导出行程
router.get('/:trip_id/export', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const { trip_id } = request.params;
  const text = await tripService.exportTrip(openid, trip_id);
  return { code: 0, data: text };
});

export default router;
