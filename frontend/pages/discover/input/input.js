// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';

Page({
  data: {
    // 位置
    locationMode: 'manual',   // 'loc'=已定位, 'manual'=手动
    locationText: '',
    currentProvince: null,     // { code, name }
    currentCity: null,        // { code, name }
    provinceList: [],

    // 弹窗
    showProvincePicker: false,
    showCityPicker: false,
    filteredProvinces: [],
    filteredCities: [],
    cityList: [],

    // 表单
    days: 2,
    budget: '',
    preferences: [],

    // 常量
    budgetOptions: BUDGET_OPTIONS,
    preferenceOptions: PREFERENCE_OPTIONS,
  },

  onLoad() {
    this.loadProvinces();
    this.loadLastLocation();
  },

  // 恢复上次手动选择的位置
  loadLastLocation() {
    const saved = wx.getStorageSync('user_location');
    if (saved && (saved.province || saved.city)) {
      this.setData({
        locationMode: saved.locationMode || 'manual',
        currentProvince: saved.province || null,
        currentCity: saved.city || null,
        locationText: this.formatLocationText(saved.province, saved.city),
      });
    }
  },

  formatLocationText(province, city) {
    if (province && city) return province.name + ' ' + city.name;
    if (province) return province.name;
    if (city) return city.name;
    return '请选择位置';
  },

  // ========== 加载省份 ==========
  async loadProvinces() {
    try {
      const res = await wx.request({
        url: 'http://localhost:3000/api/destinations/provinces',
        method: 'GET',
        timeout: 8000,
      });
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        this.setData({ provinceList: res.data });
      }
    } catch (e) {
      console.error('加载省份失败', e);
    }
  },

  async loadCities(provinceCode) {
    try {
      const res = await wx.request({
        url: `http://localhost:3000/api/destinations/cities/${provinceCode}`,
        method: 'GET',
        timeout: 8000,
      });
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (e) {
      console.error('加载城市失败', e);
    }
    return [];
  },

  // ========== 微信定位 ==========
  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.doReverseGeocode(res.latitude, res.longitude);
      },
      fail: (err) => {
        console.error('定位失败', err);
        wx.showToast({ title: '定位失败，请在地图上选择', icon: 'none' });
      }
    });
  },

  async doReverseGeocode(lat, lng) {
    wx.showLoading({ title: '识别位置中...', mask: true });
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

        // 匹配省份
        const provinceList = this.data.provinceList;
        const matchedProvince = provinceList.find(p =>
          rawProvince.includes(p.name) || p.name.includes(rawProvince)
        ) || null;

        const locationData = {
          locationMode: 'loc',
          currentProvince: matchedProvince,
          currentCity: { code: '', name: rawCity },
          locationText: matchedProvince
            ? matchedProvince.name + ' ' + rawCity
            : rawProvince + ' ' + rawCity,
        };

        this.setData(locationData);
        this.saveLocation(locationData);
        wx.showToast({ title: '定位成功', icon: 'success' });
      } else {
        throw new Error('逆地理编码失败');
      }
    } catch (e) {
      wx.hideLoading();
      console.error('逆地理编码失败', e);
      wx.showToast({ title: '位置识别失败，请手动选择', icon: 'none' });
    }
  },

  saveLocation(data) {
    wx.setStorageSync('user_location', {
      locationMode: data.locationMode,
      province: data.currentProvince,
      city: data.currentCity,
    });
  },

  // ========== 手动选择 ==========
  onManualLocation() {
    if (this.data.provinceList.length === 0) {
      wx.showToast({ title: '省份数据加载中，请稍后', icon: 'none' });
      return;
    }
    this.setData({
      showProvincePicker: true,
      filteredProvinces: this.data.provinceList,
      provinceInput: '',
    });
  },

  onProvinceSearch(e) {
    const kw = e.detail.value.trim();
    const all = this.data.provinceList;
    if (!kw) {
      this.setData({ filteredProvinces: all });
      return;
    }
    this.setData({
      filteredProvinces: all.filter(p => p.name.includes(kw) || kw.includes(p.name)),
    });
  },

  async onProvinceTap(e) {
    const { code, name } = e.currentTarget.dataset;
    wx.showLoading({ title: '加载中...', mask: true });
    const cities = await this.loadCities(code);
    wx.hideLoading();
    this.setData({
      showProvincePicker: false,
      showCityPicker: true,
      currentProvince: { code, name },
      currentCity: null,
      cityList: cities,
      filteredCities: cities,
      cityInput: '',
    });
  },

  onCitySearch(e) {
    const kw = e.detail.value.trim();
    const all = this.data.cityList;
    if (!kw) {
      this.setData({ filteredCities: all });
      return;
    }
    this.setData({
      filteredCities: all.filter(c => c.name.includes(kw) || kw.includes(c.name)),
    });
  },

  onCityTap(e) {
    const { code, name } = e.currentTarget.dataset;
    const { currentProvince } = this.data;
    const locationText = currentProvince ? currentProvince.name + ' ' + name : name;
    const locationData = {
      locationMode: 'manual',
      currentProvince,
      currentCity: { code, name },
      locationText,
    };
    this.setData(locationData);
    this.saveLocation(locationData);
    this.setData({ showCityPicker: false });
  },

  onPickerClose() {
    this.setData({ showProvincePicker: false, showCityPicker: false });
  },

  // ========== 天数 ==========
  onDaysChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    const days = Math.max(1, Math.min(7, this.data.days + delta));
    this.setData({ days });
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
      if (prefs.length >= 3) {
        wx.showToast({ title: '最多选3个', icon: 'none' });
        return;
      }
      this.setData({ preferences: [...prefs, value] });
    }
  },

  // ========== 开始推荐 ==========
  onRecommend() {
    const { currentProvince, currentCity, days, budget, preferences, locationMode } = this.data;

    if (!currentProvince && !currentCity) {
      wx.showToast({ title: '请先选择位置', icon: 'none' });
      return;
    }

    if (!budget) {
      wx.showToast({ title: '请选择人均预算', icon: 'none' });
      return;
    }

    const params = {
      location_mode: locationMode,
      province: currentProvince?.name || '',
      city: currentCity?.name || '',
      days,
      budget,
      preferences,
    };

    wx.setStorageSync('discover_params', params);
    wx.navigateTo({ url: '/pages/discover/result/result' });
  },
});
