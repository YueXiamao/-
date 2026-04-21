// 小程序入口
App({
  onLaunch() {
    // 检查登录状态
    this.checkLogin();
  },

  globalData: {
    userInfo: null,
    openid: null
  },

  async checkLogin() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
      return;
    }

    // 触发登录
    try {
      const res = await wx.cloud?.callFunction({ name: 'login' }) ||
        await new Promise((resolve, reject) => {
          wx.login({
            success: async (res) => {
              if (!res.code) return reject(new Error('no code'));
              // 静默登录，不阻塞
              resolve({ code: res.code });
            }
          });
        });
    } catch (e) {
      console.log('登录失败', e);
    }
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
  }
});
