// 小程序入口
const BASE_URL = 'http://localhost:3000';

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
        wx.request({
          url: `${BASE_URL}/api/auth/login`,
          method: 'POST',
          data: { code: res.code },
          success: (r) => {
            if (r.data && r.data.openid) {
              this.setOpenid(r.data.openid);
            }
          }
        });
      }
    });
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
  }
});
