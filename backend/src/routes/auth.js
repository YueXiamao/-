// 微信登录
import { userService } from '../services/userService.js';
import { Errors } from '../middleware/errorHandler.js';

// 统一响应格式
function ok(data) {
  return { code: 0, message: 'success', data };
}

export default async function authRoutes(fastify) {
  // 微信 code 登录
  fastify.post('/login', async (req) => {
    const { code } = req.body || {};
    if (!code) {
      throw Errors.VALIDATION_ERROR('缺少 code 参数');
    }

    // 微信接口获取 openid
    const { config } = await import('../config/index.js');
    const axios = (await import('axios')).default;

    let openid;
    try {
      const wxResp = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: config.wechat.appid,
          secret: config.wechat.secret,
          js_code: code,
          grant_type: 'authorization_code'
        },
        timeout: 5000
      });
      openid = wxResp.data.openid;
      if (!openid) {
        throw Errors.UNAUTHORIZED('微信登录失败: ' + (wxResp.data.errmsg || '未返回 openid'));
      }
    } catch (err) {
      if (err.statusCode) throw err;
      throw Errors.INTERNAL_ERROR('微信服务不可用');
    }

    const userId = userService.upsertUser(openid);
    return ok({ user_id: userId, openid, is_new_user: false });
  });
}
