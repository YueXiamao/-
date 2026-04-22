// pages/index/index.js
import { api } from '../../services/api.js';
import { authApi } from '../../services/auth.js';

Page({
  data: {},

  onLoad() {
    this.checkLogin();
  },

  async checkLogin() {
    let openid = wx.getStorageSync('openid');
    if (!openid) {
      try {
        const code = await this.doWxLogin();
        await this.loginToServer(code);
      } catch (e) {
        console.log('静默登录失败', e);
      }
    }
  },

  doWxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) resolve(res.code);
          else reject(new Error('no code'));
        },
        fail: reject
      });
    });
  },

  async loginToServer(code) {
    try {
      const res = await authApi.login(code);
      wx.setStorageSync('openid', res.openid);
      getApp().globalData.openid = res.openid;
    } catch (e) {
      console.error('服务端登录失败', e);
    }
  },

  goToPlan() {
    wx.navigateTo({ url: '/pages/plan/destination/destination' });
  },

  goToDiscover() {
    wx.navigateTo({ url: '/pages/discover/input/input' });
  }
});
