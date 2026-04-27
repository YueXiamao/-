import { api } from '../../../services/api.js';
import { isValidDate } from '../../../utils/index.js';

const app = getApp();

Page({
  data: {
    loading: true,
    recommendations: [],
    currentIndex: 0,
    cachedParams: null,
  },

  onLoad(options) {
    // 读取上一页存入的参数
    const params = wx.getStorageSync('discover_params');
    if (!params) {
      wx.showToast({ title: '参数缺失，请重新选择', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ cachedParams: params });
    this.fetchRecommendations(params);
  },

  async fetchRecommendations(params) {
    this.setData({ loading: true });
    try {
      const res = await api.post('/api/discover/recommend', {
        current_location: {
          latitude: params.latitude || '',
          longitude: params.longitude || '',
          city: params.city || '',
        },
        days: parseInt(params.days) || 2,
        budget: params.budget || '1000-2000',
        preferences: params.preferences || [],
      });

      this.setData({
        loading: false,
        recommendations: res.recommendations || [],
      });
    } catch (err) {
      console.error('推荐接口失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  },

  onViewDetail(e) {
    const { name, city, province } = e.currentTarget.dataset;
    // TODO: 跳转目的地详情页（v2.0）
    wx.showToast({ title: `${name} 详情页开发中`, icon: 'none' });
  },

  onGenerateTrip(e) {
    const { name, city, province } = e.currentTarget.dataset;
    const params = this.data.cachedParams || {};
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + ((parseInt(params.days) || 2) - 1) * 86400000);

    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    wx.navigateTo({
      url: `/pages/plan/result/result?destination=${encodeURIComponent(name)}&city=${encodeURIComponent(city || name)}&province=${encodeURIComponent(province || '')}&days=${params.days || 2}&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&preferences=${encodeURIComponent(JSON.stringify(params.preferences || []))}`,
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
