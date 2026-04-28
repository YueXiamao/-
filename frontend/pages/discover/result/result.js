// pages/discover/result/result.js
import discoverApi from '../../../services/discover.js';
import { isBackendUnavailableError } from '../../../services/backend-health.js';

Page({
  data: {
    loading: true,
    error: null,
    isOffline: false,
    recommendations: [],
  },

  onLoad() {
    const params = wx.getStorageSync('discover_params');
    if (!params) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.fetchRecommendations(params);
  },

  async fetchRecommendations(params) {
    this.setData({ loading: true, error: null, isOffline: false });
    try {
      const recs = await discoverApi.recommend({
        current_location: { city: params.city || '', province: params.province || '' },
        days: parseInt(params.days) || 2,
        budget: params.budget || '1000-2000',
        preferences: params.preferences || [],
      });
      this.setData({ loading: false, recommendations: Array.isArray(recs) ? recs : [] });
      if (!recs || recs.length === 0) {
        this.setData({ error: '暂未找到合适的目的地，请尝试调整条件' });
      }
    } catch (err) {
      console.error('推荐接口失败', err);
      const isOffline = isBackendUnavailableError(err);
      this.setData({
        loading: false,
        isOffline,
        error: isOffline
          ? '本地后端服务未启动，请先启动 backend 服务后再重试'
          : '网络异常，请稍后重试'
      });
    }
  },

  onRetry() {
    const params = wx.getStorageSync('discover_params');
    if (params) this.fetchRecommendations(params);
  },

  onBack() { wx.navigateBack(); },

  onViewDetail(e) {
    const { name } = e.currentTarget.dataset;
    wx.showToast({ title: `${name} 详情开发中`, icon: 'none' });
  },

  onGenerateTrip(e) {
    const { name, city, province } = e.currentTarget.dataset;
    const params = wx.getStorageSync('discover_params') || {};
    const days = parseInt(params.days) || 2;
    const startDate = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    wx.navigateTo({
      url: `/pages/plan/result/result?destination=${encodeURIComponent(name)}&city=${encodeURIComponent(city || name)}&province=${encodeURIComponent(province || '')}&days=${days}&start_date=${fmt(startDate)}&preferences=${encodeURIComponent(JSON.stringify(params.preferences || []))}`,
    });
  },
});
