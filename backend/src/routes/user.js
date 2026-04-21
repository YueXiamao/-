// 用户偏好路由
import Fastify from 'fastify';
import { userService } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Fastify();

// 上报偏好
router.post('/preference', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const { destinations, preferences, extra_notes_keywords } = request.body;
  await userService.recordPreference(openid, { destinations, preferences, extra_notes_keywords });
  return { code: 0, message: '偏好已记录' };
});

// 获取用户偏好
router.get('/preference', async (request, reply) => {
  const openid = request.headers['x-openid'];
  if (!openid) {
    throw AppError.UNAUTHORIZED('需要登录');
  }

  const prefs = await userService.getUserPreferences(openid);
  return { code: 0, data: prefs };
});

export default router;
