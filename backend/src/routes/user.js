// 用户路由
import { userService } from '../services/userService.js';

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

  // 更新偏好
  fastify.post('/preferences', async (req) => {
    const openid = req.headers['x-openid'] || '';
    const { preferences } = req.body || [];
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) throw new Error('用户不存在');
    userService.upsertPreferences(userId, preferences);
    return { success: true };
  });
}
