// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';
import { getLocalProvinces, getLocalCities } from '../../../services/region-db.js';
import { locationApi } from '../../../services/location.js';

Page({
  data: {
    locationMode: 'manual',
    locationText: '',
    currentProvince: null,
    currentCity: null,

    showPicker: false,
    pickerStep: 'province',
    filteredList: [],
    cityList: [],

    days: 2,
    budget: '',
    preferences: [],
    preferenceOptions: PREFERENCE_OPTIONS.map(item => ({ ...item, selected: false })),

    budgetOptions: BUDGET_OPTIONS,

    // 校验状态
    locationError: false,
    budgetError: false,
    prefsError: false,
  },

  onLoad() {
    this.loadLastLocation();
  },

  loadLastLocation() {
    const saved = wx.getStorageSync('user_location');
    if (saved && (saved.province || saved.city)) {
      this.setData({
        locationMode: saved.locationMode || 'manual',
        currentProvince: saved.province || null,
        currentCity: saved.city || null,
        locationText: this.fmtText(saved.province, saved.city),
      });
    }
  },

  fmtText(province, city) {
    if (province && city) return province.name + ' ' + city.name;
    if (province) return province.name;
    if (city) return city.name;
    return '';
  },

  // ========== 微信定位 ==========
  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        if (!res.latitude || !res.longitude || res.latitude < 1) {
          wx.showToast({ title: '无法获取有效位置，请手动选择', icon: 'none' });
          this.openPicker();
          return;
        }
        // 经纬度通过后端逆地理编码（P0-3 任务会完善）
        this.doReverseGeocode(res.latitude, res.longitude);
      },
      fail: () => {
        wx.showToast({ title: '定位失败，请手动选择', icon: 'none' });
        this.openPicker();
      }
    });
  },

  async doReverseGeocode(lat, lng) {
    wx.showLoading({ title: '识别位置...', mask: true });
    try {
      const data = await locationApi.reverseGeocode(lat, lng);
      wx.hideLoading();
      if (!data) throw new Error('no data');
      const { province, city } = data;
      const provinces = getLocalProvinces();
      const matched = provinces.find(p =>
        (province && (province.includes(p.name) || p.name.includes(province))) ||
        (province && province === p.name)
      ) || null;
      const locationData = {
        locationMode: 'loc',
        currentProvince: matched,
        currentCity: { code: '', name: city || province || '' },
        locationText: province && city ? province + ' ' + city : (province || city || ''),
      };
      this.setData(locationData);
      this.saveLocation(locationData);
      wx.showToast({ title: '定位成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '位置识别失败，请手动选择', icon: 'none' });
      this.openPicker();
    }
  },

  saveLocation(data) {
    wx.setStorageSync('user_location', {
      locationMode: data.locationMode,
      province: data.currentProvince,
      city: data.currentCity,
    });
  },

  // ========== 手动选择（使用本地数据，无网络）==========
  openPicker() {
    const provinces = getLocalProvinces();
    this.setData({
      showPicker: true,
      pickerStep: 'province',
      filteredList: provinces,
      searchValue: '',
      cityList: [],
    });
  },

  onPickerSearch(e) {
    const kw = e.detail.value.trim();
    const src = this.data.pickerStep === 'province'
      ? getLocalProvinces()
      : this.data.cityList;
    const filtered = kw
      ? src.filter(item => item.name.includes(kw) || kw.includes(item.name))
      : src;
    this.setData({ filteredList: filtered, searchValue: kw });
  },

  onPickerSelect(e) {
    const { code, name } = e.currentTarget.dataset;
    if (this.data.pickerStep === 'province') {
      const cities = getLocalCities(code);
      this.setData({
        pickerStep: 'city',
        currentProvince: { code, name },
        currentCity: null,
        cityList: cities,
        filteredList: cities,
        searchValue: '',
      });
    } else {
      const { currentProvince } = this.data;
      const text = currentProvince ? currentProvince.name + ' ' + name : name;
      const data = {
        locationMode: 'manual',
        currentProvince,
        currentCity: { code, name },
        locationText: text,
      };
      this.setData({ ...data, showPicker: false });
      this.saveLocation(data);
    }
  },

  onPickerBack() {
    if (this.data.pickerStep === 'city') {
      const provinces = getLocalProvinces();
      this.setData({
        pickerStep: 'province',
        currentCity: null,
        filteredList: provinces,
        searchValue: '',
      });
    }
  },

  onPickerClose() {
    this.setData({ showPicker: false });
  },

  // ========== 位置/预算/偏好选择时清除错误标记 ==========
  clearErrors() {
    this.setData({ locationError: false, budgetError: false, prefsError: false });
  },

  // ========== 天数 ==========
  onDaysChange(e) {
    this.clearErrors();
    const delta = parseInt(e.currentTarget.dataset.delta);
    this.setData({ days: Math.max(1, Math.min(7, this.data.days + delta)) });
  },

  // ========== 预算 ==========
  onBudgetTap(e) {
    this.clearErrors();
    const { value } = e.currentTarget.dataset;
    this.setData({ budget: this.data.budget === value ? '' : value });
  },

  // ========== 偏好 ==========
  onPrefTap(e) {
    this.clearErrors();
    const { value } = e.currentTarget.dataset;
    const prefs = this.data.preferences;
    const idx = prefs.indexOf(value);

    if (idx >= 0) {
      // 取消选中
      const preferenceOptions = this.data.preferenceOptions.map(item =>
        item.value === value ? { ...item, selected: false } : item
      );
      this.setData({
        preferences: prefs.filter(p => p !== value),
        preferenceOptions,
      });
    } else {
      if (prefs.length >= 3) { wx.showToast({ title: '最多选3个', icon: 'none' }); return; }
      const preferenceOptions = this.data.preferenceOptions.map(item =>
        item.value === value ? { ...item, selected: true } : item
      );
      this.setData({
        preferences: [...prefs, value],
        preferenceOptions,
      });
    }
  },

  // ========== 开始 ==========
  onRecommend() {
    const { currentProvince, currentCity, budget, preferences } = this.data;

    // 位置校验
    if (!currentProvince && !currentCity) {
      this.setData({ locationError: true });
      wx.showToast({ title: '请先选择位置', icon: 'none' });
      return;
    }
    // 预算校验
    if (!budget) {
      this.setData({ locationError: false, budgetError: true });
      wx.showToast({ title: '请选择人均预算', icon: 'none' });
      return;
    }
    // 偏好提示（可选，不强制）
    if (preferences.length === 0) {
      wx.showToast({ title: '建议至少选一个游玩偏好，体验更佳', icon: 'none' });
    }

    const params = {
      location_mode: this.data.locationMode,
      province: currentProvince?.name || '',
      city: currentCity?.name || '',
      days: this.data.days,
      budget,
      preferences,
    };
    wx.setStorageSync('discover_params', params);
    wx.navigateTo({ url: '/pages/discover/result/result' });
  },
});
