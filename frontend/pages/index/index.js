// pages/index/index.js

Page({
  data: {
    username: '旅行者',
    hasRecentTrips: false,
  },

  onLoad() {
    const username = wx.getStorageSync('username') || '旅行者';
    this.setData({ username });

    // 静默检查后端，不阻塞渲染
    this.checkBackendHealth();
    this.loadRecentTrips();
  },

  onShow() {
    this.loadRecentTrips();
  },

  async checkBackendHealth() {
    try {
      const res = await wx.request({
        url: 'http://localhost:3000/health',
        method: 'GET',
        timeout: 3000,
      });
      if (res.statusCode !== 200) {
        console.warn('Backend unavailable');
      }
    } catch (e) {
      console.warn('Backend check skipped:', e.message);
    }
  },

  loadRecentTrips() {
    try {
      const trips = wx.getStorageSync('recent_trips') || [];
      this.setData({ hasRecentTrips: trips.length > 0 });
    } catch (e) {
      this.setData({ hasRecentTrips: false });
    }
  },

  goPlan() {
    wx.navigateTo({ url: '/pages/plan/destination/destination' });
  },

  goDiscover() {
    wx.navigateTo({ url: '/pages/discover/input/input' });
  },
});
