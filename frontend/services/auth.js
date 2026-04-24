// 微信登录 API
import { api } from './api.js';

export const authApi = {
  // 登录
  login(code) {
    return api.post('/api/auth/login', { code });
  }
};

export default authApi;
