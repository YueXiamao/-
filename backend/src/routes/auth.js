// 微信登录路由
import Fastify from 'fastify';
import axios from 'axios';
import { config } from '../config/index.js';
import { userService } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Fastify();

// 微信登录
router.post('/login', async (request, reply) => {
  const { code } = request.body;

  if (!code) {
    throw AppError.VALIDATION_ERROR('code 不能为空');
  }

  // 用 code 换取 openid
  const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wechat.appid}&secret=${config.wechat.secret}&js_code=${code}&grant_type=authorization_code`;

  let wxResult;
  try {
    const res = await axios.get(wxUrl);
    wxResult = res.data;
  } catch (err) {
    throw AppError.INTERNAL_ERROR('微信服务调用失败');
  }

  if (wxResult.errcode) {
    throw AppError.INTERNAL_ERROR(`微信登录失败: ${wxResult.errmsg}`);
  }

  const { openid, session_key } = wxResult;

  // 查找或创建用户
  const user = await userService.findOrCreateUser(openid);

  return {
    code: 0,
    data: {
      openid: user.openid,
      is_new_user: user.created
    }
  };
});

export default router;
