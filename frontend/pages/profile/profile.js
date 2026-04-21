// pages/profile/profile.js
import tripApi from '../../services/trip.js';

Page({
  data: {
    openid: '',
    tripList: [],
    loading: false,
    empty: true
  },

  onLoad() {
    const openid = wx.getStorageSync('openid');
    this.setData({ openid });
  },

  onShow() {
    if (wx.getStorageSync('openid')) {
      this.loadTrips();
    }
  },

  async loadTrips() {
    this.setData({ loading: true });
    try {
      const result = await tripApi.list({ page: 1, page_size: 20 });
      this.setData({
        tripList: result.list || [],
        empty: !result.list || result.list.length === 0,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      console.error('加载失败', err);
    }
  },

  // 查看行程
  onTripTap(e) {
    const { tripId } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/plan/result/result?trip_id=${tripId}` });
  },

  // 删除行程
  async onTripDelete(e) {
    const { tripId } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            await tripApi.delete(tripId);
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadTrips();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 跳转到首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
