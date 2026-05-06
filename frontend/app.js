import { ensureLogin } from './services/auth.js';

App({
  onLaunch() {
    ensureLogin(wx).then(({ openid }) => {
      if (openid) {
        this.globalData.openid = openid;
        console.log('[Auth] 登录成功 openid:', openid);
      }
    }).catch(err => {
      console.warn('[Auth] 静默登录失败:', err?.message);
    });
  },

  globalData: {
    userInfo: null,
    openid: null,
  },
});
