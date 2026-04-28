// pages/discover/result/result.js
import discoverApi from '../../../services/discover.js';
import { isBackendUnavailableError } from '../../../services/backend-health.js';
import { track, EVENT_TYPES } from '../../../services/analytics.js';

Page({
  data: {
    loading: true,
    error: null,
    isOffline: false,
    recommendations: [],
    expandedIndex: null,
    expandedRec: null,
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
      // 曝光埋点
      if (Array.isArray(recs) && recs.length > 0) {
        track(EVENT_TYPES.DISCOVER_RECOMMEND_VIEW, {
          payload: { count: recs.length, params }
        });
      }
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
    const { index } = e.currentTarget.dataset;
    const { recommendations } = this.data;
    if (!recommendations || !recommendations[index]) return;

    const rec = recommendations[index];
    const expanded = this.data.expandedIndex === index ? null : index;

    this.setData({ expandedIndex: expanded, expandedRec: expanded !== null ? rec : null });

    // 展开详情时埋点
    if (expanded !== null) {
      track(EVENT_TYPES.DISCOVER_DETAIL_OPEN, {
        name: rec?.name || '',
        city: rec?.city || '',
        rank: index + 1,
      });
    }
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

    // 写 trip_params，plan/result.js onLoad 会自动读取并触发行程生成
    wx.setStorageSync('trip_params', {
      destinations: [
        {
          name,
          province: province || '',
          city: city || name,
          level: 'city',
        },
      ],
      start_date: fmt(startDate),
      days,
      preferences: params.preferences || [],
      extra_notes: `来自随机玩推荐：${name}`,
    });

    wx.navigateTo({ url: '/pages/plan/result/result' });
  },
});
