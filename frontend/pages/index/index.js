Page({
  data: {
    username: '旅行者',
    hasRecentTrips: false,
    recentTripCount: 0
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
      this.setData({
        hasRecentTrips: trips.length > 0,
        recentTripCount: trips.length
      });
    } catch (e) {
      this.setData({
        hasRecentTrips: false,
        recentTripCount: 0
      });
    }
  },

  goPlan() {
    wx.navigateTo({ url: '/pages/plan/destination/destination' });
  },

  goDiscover() {
    wx.navigateTo({ url: '/pages/discover/input/input' });
  }
});
