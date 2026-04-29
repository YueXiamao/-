import { PREFERENCE_OPTIONS, MIN_DAYS, MAX_DAYS, getCityBackground } from '../../../constants/index.js';
import { isValidDate } from '../../../utils/index.js';
import { loginGate } from '../../../services/login-gate.js';
import { buildPlanParamsDraftState } from './draft-state.js';

Page({
  data: {
    destinations: [],
    startDate: '',
    days: 2,
    preferences: [],
    extraNotes: '',
    preferenceOptions: PREFERENCE_OPTIONS.map((item) => ({ ...item, selected: false })),
    minDays: MIN_DAYS,
    maxDays: MAX_DAYS,
    loading: false,
    today: '',
    pageBackground: getCityBackground()
  },

  onLoad() {
    const destinations = wx.getStorageSync('trip_destinations') || [];
    if (destinations.length === 0) {
      wx.navigateBack();
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = tomorrow.toISOString().split('T')[0];
    const draftState = buildPlanParamsDraftState({
      destinations,
      draftParams: wx.getStorageSync('trip_params'),
      fallbackDate: todayStr
    });

    this.setData({
      destinations,
      startDate: draftState.startDate,
      days: draftState.days,
      preferences: draftState.preferences,
      extraNotes: draftState.extraNotes,
      preferenceOptions: draftState.preferenceOptions,
      today: todayStr,
      pageBackground: getCityBackground(destinations)
    });
  },

  onDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  onDaysChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    const days = Math.max(MIN_DAYS, Math.min(MAX_DAYS, this.data.days + delta));
    this.setData({ days });
  },

  onPreferenceTap(e) {
    const { value } = e.currentTarget.dataset;
    const { preferences } = this.data;
    const nextPreferences = preferences.includes(value)
      ? preferences.filter((item) => item !== value)
      : [...preferences, value];

    this.setData({
      preferences: nextPreferences,
      preferenceOptions: PREFERENCE_OPTIONS.map((item) => ({
        ...item,
        selected: nextPreferences.includes(item.value)
      }))
    });
  },

  onNotesInput(e) {
    this.setData({ extraNotes: e.detail.value });
  },

  async onGenerate() {
    const { startDate, days, preferences, destinations } = this.data;

    if (!startDate || !isValidDate(startDate)) {
      wx.showToast({ title: '请选择有效日期', icon: 'none' });
      return;
    }

    if (preferences.length === 0) {
      wx.showToast({ title: '请至少选择一个游玩方式', icon: 'none' });
      return;
    }

    const loginResult = await loginGate.ensureAuthorized({
      title: '登录后生成行程',
      content: '生成后的行程会和你的登录身份关联，方便后续保存、查看和继续调整。',
      confirmText: '授权登录',
      cancelText: '稍后再说'
    });
    if (!loginResult.authorized) return;

    const params = {
      destinations,
      start_date: startDate,
      days,
      preferences,
      extra_notes: this.data.extraNotes
    };

    wx.setStorageSync('trip_params', params);
    wx.navigateTo({
      url: '/pages/plan/result/result'
    });
  }
});
