// pages/index/index.js

Page({
  data: {
    username: '旅行者',
    hasRecentTrips: false,
  },

  onLoad() {
    const username = wx.getStorageSync('username') || '旅行者';
    this.setData({ username });
    this.loadRecentTrips();
  },

  onShow() {
    this.loadRecentTrips();
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
