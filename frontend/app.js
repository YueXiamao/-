// 小程序入口
import { api } from './services/api.js';

App({
  onLaunch() {
    this.doLogin();
  },

  globalData: {
    userInfo: null,
    openid: null
  },

  doLogin() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
      return;
    }

    wx.login({
      success: (res) => {
        if (!res.code) return;
        // 复用 api.post，内部自动处理 Base URL
        api.post('/api/auth/login', { code: res.code }, { silent: true })
          .then(data => {
            if (data?.openid) this.setOpenid(data.openid);
          })
          .catch(err => console.warn('登录失败', err));
      }
    });
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
  }
});
