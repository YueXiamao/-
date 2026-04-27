// 小程序入口
App({
  onLaunch() {
    // 检查登录状态
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
      console.log('已使用缓存 openid:', openid);
      return;
    }

    wx.login({
      success: (res) => {
        if (!res.code) {
          console.log('wx.login 无 code');
          return;
        }
        console.log('wx.login 成功, code:', res.code);
        wx.request({
          url: 'http://192.168.3.37:3000/api/auth/login',
          method: 'POST',
          data: { code: res.code },
          success: (r) => {
            console.log('/api/auth/login 响应:', r.data);
            if (r.data && r.data.openid) {
              this.setOpenid(r.data.openid);
            } else {
              console.log('登录失败: 无 openid', r.data);
            }
          },
          fail: (err) => {
            console.error('/api/auth/login 请求失败:', err);
          }
        });
      },
      fail: (err) => {
        console.error('wx.login 失败:', err);
      }
    });
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
    console.log('openid 已存储:', openid);
  }
});
