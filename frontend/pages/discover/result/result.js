// pages/discover/result/result.js
Page({
  data: {
    loading: true,
    error: null,
    recommendations: [],
    currentIndex: 0,
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
    this.setData({ loading: true, error: null });
    try {
      const res = await wx.request({
        url: 'http://localhost:3000/api/discover/recommend',
        method: 'POST',
        data: {
          current_location: {
            city: params.city || '',
            province: params.province || '',
          },
          days: parseInt(params.days) || 2,
          budget: params.budget || '1000-2000',
          preferences: params.preferences || [],
        },
        header: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      if (res.statusCode === 200 && res.data) {
        // discover API 返回: { success: true, data: { recommendations: [...] } }
        const payload = res.data.data || res.data;
        const recs = Array.isArray(payload) ? payload
          : Array.isArray(payload?.recommendations) ? payload.recommendations
          : [];

        this.setData({
          loading: false,
          recommendations: recs,
        });

        if (recs.length === 0) {
          this.setData({ error: '暂未找到合适的目的地，请尝试调整条件' });
        }
      } else {
        throw new Error(`请求失败 (${res.statusCode}): ${res.errMsg || ''}`);
      }
    } catch (err) {
      console.error('推荐接口失败', err, err.message);
      this.setData({
        loading: false,
        error: '网络异常，请重试',
      });
    }
  },

  onRetry() {
    const params = wx.getStorageSync('discover_params');
    if (params) this.fetchRecommendations(params);
  },

  onBack() {
    wx.navigateBack();
  },

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
