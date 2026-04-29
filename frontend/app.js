App({
  onLaunch() {
    this.hydrateOpenid();
  },

  globalData: {
    userInfo: null,
    openid: null
  },

  hydrateOpenid() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
    }
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    wx.setStorageSync('openid', openid);
  }
});
