// pages/discover/result/result.js
import discoverApi from '../../../services/discover.js';

Page({
  data: {
    params: null,
    recommendations: [],
    loading: true,
    error: null,
    currentIndex: 0
  },

  onLoad() {
    const params = wx.getStorageSync('discover_params');
    if (!params) {
      wx.navigateBack();
      return;
    }
    this.setData({ params });
    this.fetchRecommendations(params);
  },

  async fetchRecommendations(params) {
    this.setData({ loading: true, error: null });

    try {
      const result = await discoverApi.recommend(params);
      this.setData({
        recommendations: result.recommendations || [],
        loading: false
      });
    } catch (err) {
      console.error('推荐失败', err);
      this.setData({
        loading: false,
        error: '推荐获取失败，请稍后重试'
      });
    }
  },

  // 查看详情 -> 生成行程
  async onViewDetail(e) {
    const { index } = e.currentTarget.dataset;
    const rec = this.data.recommendations[index];
    if (!rec) return;

    // 用推荐的目的地生成行程
    wx.setStorageSync('trip_destinations', [{
      name: rec.destination.name,
      province: rec.destination.province,
      city: rec.destination.city
    }]);

    wx.setStorageSync('trip_params', {
      destinations: [{
        name: rec.destination.name,
        province: rec.destination.province,
        city: rec.destination.city
      }],
      start_date: new Date().toISOString().split('T')[0],
      days: this.data.params.days,
      preferences: this.data.params.preferences || [],
      extra_notes: ''
    });

    wx.navigateTo({ url: '/pages/plan/result/result' });
  },

  // 重试
  onRetry() {
    this.fetchRecommendations(this.data.params);
  },

  // 切换卡片
  onSwiperChange(e) {
    this.setData({ currentIndex: e.detail.current });
  },

  // 再来一次
  onAgain() {
    this.fetchRecommendations(this.data.params);
  }
});
