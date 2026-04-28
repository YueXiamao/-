import tripApi from '../../services/trip.js';
import { authApi } from '../../services/auth.js';

Page({
  data: {
    openid: '',
    tripList: [],
    loading: false,
    empty: true,
    loginRequired: false
  },

  onLoad() {
    this.tryAutoLogin();
  },

  onShow() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.setData({ openid, loginRequired: false });
      this.loadTrips();
    } else {
      this.tryAutoLogin();
    }
  },

  async tryAutoLogin() {
    this.setData({ loading: true });
    try {
      const data = await authApi.ensureLogin();
      const openid = data?.openid;
      if (!openid) throw new Error('no openid returned');
      this.setData({ openid, loginRequired: false, loading: false });
      this.loadTrips();
    } catch (err) {
      console.error('自动登录失败', err);
      this.setData({ loginRequired: true, loading: false });
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
      console.error('加载失败', err);
      this.setData({ loading: false });
    }
  },

  onTripTap(e) {
    const { tripId } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/plan/result/result?trip_id=${tripId}` });
  },

  onTripDelete(e) {
    const { tripId } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await tripApi.delete(tripId);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadTrips();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
