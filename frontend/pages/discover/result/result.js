// pages/discover/result/result.js
import discoverApi from '../../../services/discover.js';
import { getCityBackground } from '../../../constants/index.js';

Page({
  data: {
    params: null,
    recommendations: [],
    loading: true,
    error: null,
    currentIndex: 0,
    pageBackground: getCityBackground()
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
        loading: false,
        pageBackground: getCityBackground((result.recommendations || []).map(item => item.destination?.name))
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

    try {
      wx.showLoading({ title: '生成中...' });
      const trip = await discoverApi.getDestinationTrip(rec.destination.name, {
        start_date: new Date().toISOString().split('T')[0],
        days: this.data.params.days,
        preferences: this.data.params.preferences || [],
        extra_notes: ''
      });
      wx.setStorageSync('pre_generated_trip', trip);
      wx.hideLoading();
      wx.navigateTo({ url: '/pages/plan/result/result' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '行程生成失败', icon: 'none' });
    }
  },

  // 重试
  onRetry() {
    this.fetchRecommendations(this.data.params);
  },

  // 切换卡片
  onSwiperChange(e) {
    const currentIndex = e.detail.current;
    const current = this.data.recommendations[currentIndex];
    this.setData({
      currentIndex,
      pageBackground: getCityBackground([current?.destination?.name])
    });
  },

  // 再来一次
  onAgain() {
    this.fetchRecommendations(this.data.params);
  }
});
