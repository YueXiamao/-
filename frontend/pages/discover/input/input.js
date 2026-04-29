import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';
import { getLocalProvinces, getLocalCities } from '../../../services/region-db.js';
import { locationApi } from '../../../services/location.js';
import {
  buildCityPickerState,
  buildDiscoverParamsDraft,
  buildManualLocationSelection,
  formatLocationText
} from './flow-state.js';

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
    searchValue: '',

    days: 2,
    budget: '',
    preferences: [],
    preferenceOptions: PREFERENCE_OPTIONS.map((item) => ({ ...item, selected: false })),
    budgetOptions: BUDGET_OPTIONS,

    locationError: false,
    budgetError: false,
    prefsError: false
  },

  onLoad() {
    this.loadLastLocation();
  },

  loadLastLocation() {
    const saved = wx.getStorageSync('user_location');
    if (!saved || (!saved.province && !saved.city)) return;

    this.setData({
      locationMode: saved.locationMode || 'manual',
      currentProvince: saved.province || null,
      currentCity: saved.city || null,
      locationText: this.formatLocationText(saved.province, saved.city)
    });
  },

  formatLocationText,

  clearErrors() {
    this.setData({
      locationError: false,
      budgetError: false,
      prefsError: false
    });
  },

  saveLocation(data) {
    wx.setStorageSync('user_location', {
      locationMode: data.locationMode,
      province: data.currentProvince,
      city: data.currentCity
    });
  },

  onManualLocation() {
    this.clearErrors();
    this.openPicker();
  },

  openPicker() {
    const provinces = getLocalProvinces();
    this.setData({
      showPicker: true,
      pickerStep: 'province',
      filteredList: provinces,
      cityList: [],
      searchValue: ''
    });
  },

  onPickerSearch(e) {
    const keyword = (e.detail.value || '').trim();
    const source = this.data.pickerStep === 'province'
      ? getLocalProvinces()
      : this.data.cityList;

    const filteredList = keyword
      ? source.filter((item) => item.name.includes(keyword) || keyword.includes(item.name))
      : source;

    this.setData({
      searchValue: keyword,
      filteredList
    });
  },

  onProvinceQuick(e) {
    const { name } = e.currentTarget.dataset;
    const province = getLocalProvinces().find((item) => item.name === name);
    if (!province) return;
    this.enterCityStep(province.code, province.name);
  },

  onProvinceSelect(e) {
    const { code, name } = e.currentTarget.dataset;
    this.enterCityStep(code, name);
  },

  enterCityStep(code, name) {
    this.clearErrors();
    const cityList = getLocalCities(code);
    this.setData(buildCityPickerState({ code, name }, cityList));
  },

  onCitySelect(e) {
    const { code, name } = e.currentTarget.dataset;
    const locationData = buildManualLocationSelection(
      this.data.currentProvince,
      { code, name }
    );

    this.clearErrors();
    this.setData({
      ...locationData,
      showPicker: false
    });
    this.saveLocation(locationData);
  },

  onPickerBack() {
    if (this.data.pickerStep !== 'city') return;

    this.setData({
      pickerStep: 'province',
      currentCity: null,
      filteredList: getLocalProvinces(),
      searchValue: ''
    });
  },

  onPickerClose() {
    this.setData({ showPicker: false });
  },

  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        if (!res.latitude || !res.longitude || res.latitude < 1) {
          wx.showToast({ title: '无法获取有效位置，请手动选择', icon: 'none' });
          this.openPicker();
          return;
        }

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
      const currentProvince = provinces.find((item) => (
        province && (province.includes(item.name) || item.name.includes(province))
      )) || null;

      const locationData = {
        locationMode: 'loc',
        currentProvince,
        currentCity: { code: '', name: city || province || '' },
        locationText: province && city ? `${province} ${city}` : (province || city || '')
      };

      this.clearErrors();
      this.setData(locationData);
      this.saveLocation(locationData);
      wx.showToast({ title: '定位成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '位置识别失败，请手动选择', icon: 'none' });
      this.openPicker();
    }
  },

  onDaysChange(e) {
    this.clearErrors();
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    this.setData({
      days: Math.max(1, Math.min(7, this.data.days + delta))
    });
  },

  onBudgetTap(e) {
    this.clearErrors();
    const { value } = e.currentTarget.dataset;
    this.setData({
      budget: this.data.budget === value ? '' : value
    });
  },

  onPrefTap(e) {
    this.clearErrors();
    const { value } = e.currentTarget.dataset;
    const selected = this.data.preferences.includes(value);

    if (!selected && this.data.preferences.length >= 3) {
      wx.showToast({ title: '最多选 3 个', icon: 'none' });
      return;
    }

    const preferences = selected
      ? this.data.preferences.filter((item) => item !== value)
      : [...this.data.preferences, value];

    this.setData({
      preferences,
      preferenceOptions: PREFERENCE_OPTIONS.map((item) => ({
        ...item,
        selected: preferences.includes(item.value)
      }))
    });
  },

  onRecommend() {
    const { currentProvince, currentCity, budget, preferences, locationMode, days } = this.data;

    if (!currentProvince && !currentCity) {
      this.setData({ locationError: true });
      wx.showToast({ title: '请先选择位置', icon: 'none' });
      return;
    }

    if (!budget) {
      this.setData({ locationError: false, budgetError: true });
      wx.showToast({ title: '请选择人均预算', icon: 'none' });
      return;
    }

    if (preferences.length === 0) {
      wx.showToast({ title: '建议至少选一个游玩偏好，推荐会更准', icon: 'none' });
    }

    wx.setStorageSync('discover_params', {
      ...buildDiscoverParamsDraft({
        locationMode,
        currentProvince,
        currentCity,
        days,
        budget,
        preferences
      })
    });

    wx.navigateTo({ url: '/pages/discover/result/result' });
  }
});
