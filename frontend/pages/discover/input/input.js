// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';

Page({
  data: {
    locationMode: 'manual',
    locationText: '',
    currentProvince: null,
    currentCity: null,
    provinceList: [],

    // 选择器
    showPicker: false,
    pickerStep: 'province',   // 'province' | 'city'
    filteredList: [],
    searchValue: '',
    cityList: [],

    // 表单
    days: 2,
    budget: '',
    preferences: [],

    budgetOptions: BUDGET_OPTIONS,
    preferenceOptions: PREFERENCE_OPTIONS,
  },

  onLoad() {
    this.loadProvinces();
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

  // ========== 加载省份 ==========
  async loadProvinces() {
    try {
      const res = await wx.request({
        url: 'http://localhost:3000/api/destinations/provinces',
        method: 'GET',
        timeout: 8000,
      });
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        this.setData({ provinceList: res.data, filteredList: res.data });
      }
    } catch (e) {
      console.error('加载省份失败', e);
    }
  },

  async loadCities(code) {
    try {
      const res = await wx.request({
        url: `http://localhost:3000/api/destinations/cities/${code}`,
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
        // 检查坐标是否有效（非0，非极端值）
        if (!res.latitude || !res.longitude || res.latitude < 1 || res.longitude < 1) {
          wx.showToast({ title: '无法获取有效位置，请手动选择', icon: 'none' });
          this.openPicker();
          return;
        }
        this.doReverseGeocode(res.latitude, res.longitude);
      },
      fail: (err) => {
        console.error('定位失败', err);
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

        const provinceList = this.data.provinceList;
        const matched = provinceList.find(p =>
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
      console.error('逆地理编码失败', e);
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

  // ========== 手动选择（打开选择器）==========
  onManualLocation() {
    this.openPicker();
  },

  openPicker() {
    // 等省份加载完再开
    if (this.data.provinceList.length === 0) {
      wx.showLoading({ title: '加载中...', mask: true });
      this.loadProvinces().then(() => {
        wx.hideLoading();
        this.setData({ showPicker: true, pickerStep: 'province', filteredList: this.data.provinceList, searchValue: '' });
      });
    } else {
      this.setData({ showPicker: true, pickerStep: 'province', filteredList: this.data.provinceList, searchValue: '' });
    }
  },

  // ========== 选择器操作 ==========
  onPickerSearch(e) {
    const kw = e.detail.value.trim();
    const src = this.data.pickerStep === 'province' ? this.data.provinceList : this.data.cityList;
    if (!kw) {
      this.setData({ filteredList: src, searchValue: kw });
      return;
    }
    this.setData({ filteredList: src.filter(item => item.name.includes(kw) || kw.includes(item.name)), searchValue: kw });
  },

  async onPickerSelect(e) {
    const { code, name } = e.currentTarget.dataset;
    if (this.data.pickerStep === 'province') {
      wx.showLoading({ title: '加载城市...', mask: true });
      const cities = await this.loadCities(code);
      wx.hideLoading();
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
      this.setData({
        pickerStep: 'province',
        currentCity: null,
        filteredList: this.data.provinceList,
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
