// pages/plan/params/params.js
import { PREFERENCE_OPTIONS, MIN_DAYS, MAX_DAYS } from '../../../constants/index.js';
import { isValidDate, calcEndDate } from '../../../utils/index.js';

Page({
  data: {
    // 目的地（从上一页传来）
    destinations: [],

    // 表单数据
    startDate: '',
    days: 2,
    preferences: [],
    extraNotes: '',

    // 常量
    preferenceOptions: PREFERENCE_OPTIONS,
    minDays: MIN_DAYS,
    maxDays: MAX_DAYS,

    // UI
    loading: false,
    today: '' // 今天日期，限制最早选择
  },

  onLoad() {
    const destinations = wx.getStorageSync('trip_destinations') || [];
    if (destinations.length === 0) {
      wx.navigateBack();
      return;
    }

    // 设置默认日期为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = tomorrow.toISOString().split('T')[0];

    this.setData({
      destinations,
      startDate: todayStr,
      today: todayStr
    });
  },

  // 日期选择
  onDateChange(e) {
    const startDate = e.detail.value;
    this.setData({ startDate });
  },

  // 天数调整
  onDaysChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    const days = Math.max(1, Math.min(14, this.data.days + delta));
    this.setData({ days });
  },

  // 游玩方式选择
  onPreferenceTap(e) {
    const { value } = e.currentTarget.dataset;
    const { preferences } = this.data;

    if (preferences.includes(value)) {
      this.setData({ preferences: preferences.filter(p => p !== value) });
    } else {
      this.setData({ preferences: [...preferences, value] });
    }
  },

  // 补充说明输入
  onNotesInput(e) {
    this.setData({ extraNotes: e.detail.value });
  },

  // 预览行程
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

    const params = {
      destinations,
      start_date: startDate,
      days,
      preferences,
      extra_notes: this.data.extraNotes
    };

    // 存储参数
    wx.setStorageSync('trip_params', params);

    // 跳转到结果页
    wx.navigateTo({
      url: '/pages/plan/result/result'
    });
  }
});
