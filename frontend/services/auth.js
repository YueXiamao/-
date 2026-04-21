// 微信登录 API
import { api } from './api.js';

export default {
  // 登录
  login(code) {
    return api.post('/api/auth/login', { code });
  }
};
