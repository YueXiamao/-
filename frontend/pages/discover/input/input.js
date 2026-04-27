// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';

Page({
  data: {
    // 位置模式：'loc' | 'manual'
    locationMode: 'loc',
    locationText: '正在定位...',
    currentProvince: null,   // { code, name }
    currentCity: null,       // { code, name }
    provinceList: [],
    showProvincePicker: false,
    showCityPicker: false,
    provinceInput: '',
    filteredProvinces: [],

    // 表单
    days: 2,
    budget: '',
    preferences: [],

    // 常量
    budgetOptions: BUDGET_OPTIONS,
    preferenceOptions: PREFERENCE_OPTIONS,

    // UI 状态
    locationLoading: true,
    locationError: false,
  },

  onLoad() {
    this.loadProvinces();
    this.initLocation();
  },

  // ========== 行政区划加载 ==========
  async loadProvinces() {
    try {
      const res = await wx.request({
        url: 'http://localhost:3000/api/destinations/provinces',
        method: 'GET',
        timeout: 5000,
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
        timeout: 5000,
      });
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (e) {
      console.error('加载城市失败', e);
    }
    return [];
  },

  // ========== 定位 ==========
  initLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.reverseGeocode(res.latitude, res.longitude);
      },
      fail: () => {
        this.setData({
          locationText: '定位失败，请手动选择位置',
          locationLoading: false,
          locationError: true,
          locationMode: 'manual',
        });
      }
    });
  },

  async reverseGeocode(lat, lng) {
    try {
      const res = await wx.request({
        url: `https://restapi.amap.com/v3/geocode/regeo?key=d6a104130c5e6169d1e455991987eb79&location=${lng},${lat}&extensions=base`,
        method: 'GET',
        timeout: 5000,
      });
      if (res.statusCode === 200 && res.data && res.data.status === '1') {
        const comp = res.data.regeocode.addressComponent;
        const province = comp.province;
        const city = comp.city || province;

        // 匹配省份和城市
        const provinceList = this.data.provinceList;
        const matchedProvince = provinceList.find(p => p.name.startsWith(province) || province.startsWith(p.name));
        
        this.setData({
          currentProvince: matchedProvince ? { code: matchedProvince.code, name: matchedProvince.name } : null,
          currentCity: { code: '', name: city },
          locationText: province + ' ' + city,
          locationLoading: false,
          locationError: false,
          locationMode: 'loc',
        });
      } else {
        throw new Error('逆地理编码失败');
      }
    } catch (e) {
      this.setData({
        locationText: '已获取位置（城市未知）',
        locationLoading: false,
        locationError: false,
        locationMode: 'loc',
      });
    }
  },

  // ========== 手动选择位置 ==========
  onLocationInput() {
    this.setData({
      showProvincePicker: true,
      filteredProvinces: this.data.provinceList,
      provinceInput: '',
    });
  },

  onProvinceSearch(e) {
    const kw = e.detail.value.trim();
    if (!kw) {
      this.setData({ filteredProvinces: this.data.provinceList });
      return;
    }
    const filtered = this.data.provinceList.filter(p =>
      p.name.includes(kw) || kw.includes(p.name)
    );
    this.setData({ filteredProvinces: filtered, provinceInput: kw });
  },

  async onProvinceConfirm(e) {
    const { code, name } = e.currentTarget.dataset;
    const cities = await this.loadCities(code);
    this.setData({
      currentProvince: { code, name },
      currentCity: null,
      showProvincePicker: false,
      showCityPicker: true,
      cityList: cities,
      cityInput: '',
      filteredCities: cities,
    });
  },

  onCitySearch(e) {
    const kw = e.detail.value.trim();
    if (!kw) {
      this.setData({ filteredCities: this.data.cityList });
      return;
    }
    const filtered = this.data.cityList.filter(c =>
      c.name.includes(kw) || kw.includes(c.name)
    );
    this.setData({ filteredCities: filtered, cityInput: kw });
  },

  onCityConfirm(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      currentCity: { code, name },
      locationText: this.data.currentProvince.name + ' ' + name,
      locationMode: 'manual',
      showCityPicker: false,
    });
  },

  onPickerClose() {
    this.setData({
      showProvincePicker: false,
      showCityPicker: false,
    });
  },

  // ========== 重新定位 ==========
  onRelocate() {
    this.setData({ locationLoading: true, locationError: false });
    this.initLocation();
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
    if (prefs.indexOf(value) >= 0) {
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

    const province = currentProvince?.name || '';
    const city = currentCity?.name || '';

    if (!province && !city) {
      wx.showToast({ title: '请先选择或定位您的位置', icon: 'none' });
      return;
    }

    if (!budget) {
      wx.showToast({ title: '请选择人均预算', icon: 'none' });
      return;
    }

    const params = {
      location_mode: locationMode,
      province,
      city,
      days,
      budget,
      preferences,
    };

    wx.setStorageSync('discover_params', params);
    wx.navigateTo({ url: '/pages/discover/result/result' });
  },
});
