import { authApi } from './services/auth.js';

App({
  onLaunch() {
    this.doLogin();
  },

  globalData: {
    userInfo: null,
    openid: null
  },

  async doLogin() {
    try {
      const data = await authApi.ensureLogin();
      if (data?.openid) {
        this.setOpenid(data.openid);
      }
    } catch (err) {
      console.warn('登录失败（非致命）', err);
    }
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
  }
});
