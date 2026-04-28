// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';
import { getLocalProvinces, getLocalCities, getLocalDistricts } from '../../../services/region-db.js';

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
    preferenceOptions: PREFERENCE_OPTIONS,

    budgetOptions: BUDGET_OPTIONS,
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
      const res = await wx.request({
        url: `https://restapi.amap.com/v3/geocode/regeo?key=d6a104130c5e6169d1e455991987eb79&location=${lng},${lat}&extensions=base`,
        method: 'GET',
        timeout: 8000,
      });
      wx.hideLoading();
      if (res.statusCode === 200 && res.data && res.data.status === '1') {
        const comp = res.data.regeocode.addressComponent;
        const rawProvince = comp.province;
        const rawCity = comp.city || comp.province;
        const provinces = getLocalProvinces();
        const matched = provinces.find(p =>
          rawProvince.includes(p.name) || p.name.includes(rawProvince)
        ) || null;
        const data = {
          locationMode: 'loc',
          currentProvince: matched,
          currentCity: { code: '', name: rawCity },
          locationText: matched ? matched.name + ' ' + rawCity : rawProvince + ' ' + rawCity,
        };
        this.setData(data);
        this.saveLocation(data);
        wx.showToast({ title: '定位成功', icon: 'success' });
      } else {
        wx.showToast({ title: '位置识别失败，请手动选择', icon: 'none' });
        this.openPicker();
      }
    } catch (e) {
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

  // ========== 天数 ==========
  onDaysChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    this.setData({ days: Math.max(1, Math.min(7, this.data.days + delta)) });
  },

  // ========== 预算 ==========
  onBudgetTap(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({ budget: this.data.budget === value ? '' : value });
  },

  // ========== 偏好 ==========
  onPrefTap(e) {
    const { value } = e.currentTarget.dataset;
    const prefs = this.data.preferences;
    const idx = prefs.indexOf(value);
    if (idx >= 0) {
      this.setData({ preferences: prefs.filter(p => p !== value) });
    } else {
      if (prefs.length >= 3) { wx.showToast({ title: '最多选3个', icon: 'none' }); return; }
      this.setData({ preferences: [...prefs, value] });
    }
  },

  // ========== 开始 ==========
  onRecommend() {
    const { currentProvince, currentCity, budget } = this.data;
    if (!currentProvince && !currentCity) {
      wx.showToast({ title: '请先选择位置', icon: 'none' });
      return;
    }
    if (!budget) {
      wx.showToast({ title: '请选择人均预算', icon: 'none' });
      return;
    }
    const params = {
      location_mode: this.data.locationMode,
      province: currentProvince?.name || '',
      city: currentCity?.name || '',
      days: this.data.days,
      budget,
      preferences: this.data.preferences,
    };
    wx.setStorageSync('discover_params', params);
    wx.navigateTo({ url: '/pages/discover/result/result' });
  },
});
