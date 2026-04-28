// 小程序入口
import { api } from './services/api.js';
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
    // 已有 openid 直接恢复
    const existing = wx.getStorageSync('openid');
    if (existing) {
      this.globalData.openid = existing;
      return;
    }

    // 调用微信 wx.login 获取 code
    const { code } = await new Promise(wx.login);
    if (!code) return;

    try {
      // 通过 services/api.js 统一入口，api.js 会自动解析返回 data 部分
      const data = await authApi.login(code);
      const openid = data?.openid;
      if (openid) {
        this.setOpenid(openid);
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
