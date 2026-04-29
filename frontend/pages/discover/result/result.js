// pages/discover/result/result.js
import discoverApi from '../../../services/discover.js';
import { isBackendUnavailableError } from '../../../services/backend-health.js';
import { track, EVENT_TYPES } from '../../../services/analytics.js';
import { loginGate } from '../../../services/login-gate.js';
import { buildDiscoverRecommendRequest } from '../input/flow-state.js';
import { buildTripParamsFromRecommendation } from './plan-entry.js';

export function normalizeDiscoverRecommendations(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.recommendations)) return payload.recommendations;
  return [];
}

Page({
  data: {
    loading: true,
    error: null,
    isOffline: false,
    recommendations: [],
    expandedIndex: null,
    expandedRec: null
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
      const recPayload = await discoverApi.recommend(buildDiscoverRecommendRequest(params));
      const recs = normalizeDiscoverRecommendations(recPayload);
      this.setData({ loading: false, recommendations: Array.isArray(recs) ? recs : [] });

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

  onBack() {
    wx.navigateBack();
  },

  onViewDetail(e) {
    const { index } = e.currentTarget.dataset;
    const { recommendations } = this.data;
    if (!recommendations || !recommendations[index]) return;

    const rec = recommendations[index];
    const expanded = this.data.expandedIndex === index ? null : index;

    this.setData({ expandedIndex: expanded, expandedRec: expanded !== null ? rec : null });

    if (expanded !== null) {
      track(EVENT_TYPES.DISCOVER_DETAIL_OPEN, {
        name: rec?.destination?.name || '',
        city: rec?.destination?.city || '',
        rank: index + 1
      });
    }
  },

  async onGenerateTrip(e) {
    const { name, city, province } = e.currentTarget.dataset;
    const params = wx.getStorageSync('discover_params') || {};

    const loginResult = await loginGate.ensureAuthorized({
      title: '登录后生成行程',
      content: '登录后才能把推荐目的地继续生成专属行程，后续也更方便回看和保存。',
      confirmText: '授权登录',
      cancelText: '先看看'
    });
    if (!loginResult.authorized) return;

    wx.setStorageSync('trip_params', buildTripParamsFromRecommendation({
      destination: { name, city, province },
      discoverParams: params
    }));

    wx.navigateTo({ url: '/pages/plan/result/result' });
  }
});
