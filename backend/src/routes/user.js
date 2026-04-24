// 用户路由
import { userService } from '../services/userService.js';
import { Errors } from '../middleware/errorHandler.js';

export default async function userRoutes(fastify) {
  // 获取用户信息
  fastify.get('/info', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) return null;
    const user = userService.getByOpenid(openid);
    const prefs = userService.getPreferences(userId);
    return { ...user, preferences: prefs };
  });

  async function updatePreferences(req) {
    const openid = req.headers['x-openid'] || '';
    const { preferences = [] } = req.body || {};
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) throw Errors.UNAUTHORIZED('用户不存在');
    userService.upsertPreferences(userId, preferences.map((item) => (
      typeof item === 'string' ? { type: 'preference', value: item } : item
    )));
    return { success: true };
  }

  // 更新偏好
  fastify.post('/preferences', updatePreferences);
  fastify.post('/preference', updatePreferences);
}
