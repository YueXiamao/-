// pages/index/index.js
Page({
  data: {
    // 页面数据
  },

  onLoad() {
    // 检查登录
    this.checkLogin();
  },

  onShow() {
    // tabBar 切换时刷新
  },

  // 检查登录状态
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

  // 微信登录获取 code
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

  // 调用后端登录
  async loginToServer(code) {
    try {
      const { api } = require('../../services/api.js');
      const { default: authApi } = require('../../services/auth.js');
      const res = await authApi.login(code);
      wx.setStorageSync('openid', res.openid);
      getApp().globalData.openid = res.openid;
    } catch (e) {
      console.error('服务端登录失败', e);
    }
  },

  // 跳转到行程规划
  goToPlan() {
    wx.navigateTo({
      url: '/pages/plan/destination/destination'
    });
  },

  // 跳转到随机玩
  goToDiscover() {
    wx.navigateTo({
      url: '/pages/discover/input/input'
    });
  }
});
