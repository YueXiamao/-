// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';

Page({
  data: {
    // 位置
    currentLocation: null,
    locationText: '定位中...',

    // 表单
    days: 2,
    budget: '',
    preferences: [],

    // 常量
    budgetOptions: BUDGET_OPTIONS,
    preferenceOptions: PREFERENCE_OPTIONS,

    // UI
    locationLoading: true
  },

  onLoad() {
    this.getLocation();
  },

  // 获取当前位置
  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          currentLocation: {
            latitude: res.latitude,
            longitude: res.longitude,
            city: '' // 需要通过逆地理编码获取
          },
          locationText: '已获取位置',
          locationLoading: false
        });
        // 逆地理编码获取城市名
        this.reverseGeocode(res.latitude, res.longitude);
      },
      fail: () => {
        this.setData({
          locationText: '定位失败，请手动输入',
          locationLoading: false
        });
      }
    });
  },

  // 逆地理编码
  async reverseGeocode(lat, lng) {
    try {
      const { default: destinationApi } = require('../../../services/destinations.js');
      // 这里简化处理，实际应该调用高德逆地理编码 API
      this.setData({ locationText: '当前位置' });
    } catch (e) {
      this.setData({ locationText: '当前位置' });
    }
  },

  // 手动输入位置
  onLocationInput() {
    wx.showModal({
      title: '输入当前位置',
      editable: true,
      placeholderText: '请输入您当前所在城市',
      success: (res) => {
        if (res.confirm && res.content) {
          this.setData({
            currentLocation: { city: res.content, latitude: null, longitude: null },
            locationText: res.content
          });
        }
      }
    });
  },

  // 天数调整
  onDaysChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    const days = Math.max(1, Math.min(7, this.data.days + delta));
    this.setData({ days });
  },

  // 预算选择
  onBudgetTap(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({ budget: this.data.budget === value ? '' : value });
  },

  // 游玩方式
  onPrefTap(e) {
    const { value } = e.currentTarget.dataset;
    const { preferences } = this.data;
    if (preferences.includes(value)) {
      this.setData({ preferences: preferences.filter(p => p !== value) });
    } else {
      if (preferences.length >= 3) {
        wx.showToast({ title: '最多选3个', icon: 'none' });
        return;
      }
      this.setData({ preferences: [...preferences, value] });
    }
  },

  // 开始推荐
  onRecommend() {
    const { currentLocation, days, budget, preferences } = this.data;

    if (!currentLocation) {
      wx.showToast({ title: '请先获取位置或手动输入', icon: 'none' });
      return;
    }

    if (!budget) {
      wx.showToast({ title: '请选择预算', icon: 'none' });
      return;
    }

    const params = { current_location: currentLocation, days, budget, preferences };

    wx.setStorageSync('discover_params', params);
    wx.navigateTo({ url: '/pages/discover/result/result' });
  }
});
