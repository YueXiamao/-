// pages/discover/input/input.js
import { BUDGET_OPTIONS, PREFERENCE_OPTIONS } from '../../../constants/index.js';

// 直辖市列表
const MUNICIPALITIES = ['北京市', '上海市', '天津市', '重庆市'];

Page({
  data: {
    locationMode: 'manual',
    locationText: '',
    currentProvince: null,
    currentCity: null,
    currentDistrict: null,

    // 选择器
    showPicker: false,
    pickerStep: 'province',   // 'province' | 'city' | 'district'
    filteredList: [],
    cityList: [],
    districtList: [],

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
    if (saved && (saved.province || saved.city || saved.district)) {
      this.setData({
        locationMode: saved.locationMode || 'manual',
        currentProvince: saved.province || null,
        currentCity: saved.city || null,
        currentDistrict: saved.district || null,
        locationText: this.fmtText(saved.province, saved.city, saved.district),
      });
    }
  },

  fmtText(province, city, district) {
    if (district) return district.name;
    if (city) return city.name;
    if (province) return province.name;
    return '';
  },

  // ========== 数据加载 ==========
  async loadProvinces() {
    return new Promise((resolve) => {
      wx.request({
        url: 'http://localhost:3000/api/destinations/provinces',
        method: 'GET',
        timeout: 10000,
        success: (res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          this.setData({ provinceList: list });
          resolve(list);
        },
        fail: () => resolve([]),
      });
    });
  },

  async loadCities(code) {
    return new Promise((resolve) => {
      wx.request({
        url: `http://localhost:3000/api/destinations/cities/${code}`,
        method: 'GET',
        timeout: 10000,
        success: (res) => resolve(Array.isArray(res.data) ? res.data : []),
        fail: () => resolve([]),
      });
    });
  },

  async loadDistricts(code) {
    return new Promise((resolve) => {
      wx.request({
        url: `http://localhost:3000/api/destinations/districts/${code}`,
        method: 'GET',
        timeout: 10000,
        success: (res) => resolve(Array.isArray(res.data) ? res.data : []),
        fail: () => resolve([]),
      });
    });
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
    let hide = false;
    const hideLoading = () => { if (!hide) { wx.hideLoading(); hide = true; } };

    try {
      const res = await wx.request({
        url: `https://restapi.amap.com/v3/geocode/regeo?key=d6a104130c5e6169d1e455991987eb79&location=${lng},${lat}&extensions=base`,
        method: 'GET',
        timeout: 8000,
      });
      hideLoading();

      if (res.statusCode === 200 && res.data && res.data.status === '1') {
        const comp = res.data.regeocode.addressComponent;
        const rawProvince = comp.province;
        const rawCity = comp.city || comp.province;
        const rawDistrict = comp.district || '';

        const provinceList = this.data.provinceList || [];
        const matchedProvince = provinceList.find(p =>
          rawProvince.includes(p.name) || p.name.includes(rawProvince)
        ) || null;

        // 尝试匹配区县（仅直辖市场景）
        let matchedDistrict = null;
        if (matchedProvince && MUNICIPALITIES.includes(matchedProvince.name) && rawDistrict) {
          // 加载该城市的区县来匹配
          const cities = await this.loadCities(matchedProvince.code);
          const city = cities[0];
          if (city) {
            const districts = await this.loadDistricts(city.code);
            matchedDistrict = districts.find(d =>
              rawDistrict.includes(d.name) || d.name.includes(rawDistrict)
            ) || null;
          }
        }

        const data = {
          locationMode: 'loc',
          currentProvince: matchedProvince,
          currentCity: matchedDistrict ? null : { code: '', name: rawCity },
          currentDistrict: matchedDistrict,
          locationText: matchedDistrict ? rawDistrict : (matchedProvince ? matchedProvince.name + ' ' + rawCity : rawProvince + ' ' + rawCity),
        };
        this.setData(data);
        this.saveLocation(data);
        wx.showToast({ title: '定位成功', icon: 'success' });
      } else {
        wx.showToast({ title: '位置识别失败，请手动选择', icon: 'none' });
        this.openPicker();
      }
    } catch (e) {
      hideLoading();
      wx.showToast({ title: '位置识别失败，请手动选择', icon: 'none' });
      this.openPicker();
    }
  },

  saveLocation(data) {
    wx.setStorageSync('user_location', {
      locationMode: data.locationMode,
      province: data.currentProvince,
      city: data.currentCity,
      district: data.currentDistrict,
    });
  },

  // ========== 常用省份快捷选择 ==========
  onProvinceQuick(e) {
    const name = e.currentTarget.dataset.name;
    const province = (this.data.provinceList || []).find(p => p.name === name);
    if (province) {
      this.onProvinceSelect({ currentTarget: { dataset: { code: province.code, name: province.name } } });
    }
  },

  // ========== 打开选择器 ==========
  async openPicker() {
    let list = this.data.provinceList || [];
    if (!list.length) {
      wx.showLoading({ title: '加载中...', mask: true });
      list = await this.loadProvinces();
      wx.hideLoading();
    }
    this.setData({
      showPicker: true,
      pickerStep: 'province',
      filteredList: list,
      searchValue: '',
      currentCity: null,
      currentDistrict: null,
    });
  },

  onManualLocation() {
    this.openPicker();
  },

  // ========== 搜索 ==========
  onPickerSearch(e) {
    const kw = e.detail.value.trim();
    let src = [];
    if (this.data.pickerStep === 'province') src = this.data.provinceList || [];
    else if (this.data.pickerStep === 'city') src = this.data.cityList || [];
    else src = this.data.districtList || [];

    const filtered = !kw ? src : src.filter(item =>
      item.name.includes(kw) || kw.includes(item.name)
    );
    this.setData({ filteredList: filtered, searchValue: kw });
  },

  // ========== 选择省份 ==========
  async onProvinceSelect(e) {
    const { code, name } = e.currentTarget.dataset;

    // 判断是否直辖市
    if (MUNICIPALITIES.includes(name)) {
      wx.showLoading({ title: '加载区县...', mask: true });
      const cities = await this.loadCities(code);
      if (!cities.length) { wx.hideLoading(); wx.showToast({ title: '数据异常', icon: 'none' }); return; }

      const districts = await this.loadDistricts(cities[0].code);
      wx.hideLoading();

      if (!districts.length) { wx.showToast({ title: '无下辖区县', icon: 'none' }); return; }

      this.setData({
        pickerStep: 'district',
        currentProvince: { code, name },
        currentCity: null,
        currentDistrict: null,
        cityList: cities,
        districtList: districts,
        filteredList: districts,
        searchValue: '',
      });
    } else {
      wx.showLoading({ title: '加载城市...', mask: true });
      const cities = await this.loadCities(code);
      wx.hideLoading();

      if (!cities.length) { wx.showToast({ title: '无下辖城市', icon: 'none' }); return; }

      this.setData({
        pickerStep: 'city',
        currentProvince: { code, name },
        currentCity: null,
        currentDistrict: null,
        cityList: cities,
        filteredList: cities,
        searchValue: '',
      });
    }
  },

  // ========== 选择城市（仅普通省份） ==========
  onCitySelect(e) {
    const { code, name } = e.currentTarget.dataset;
    const { currentProvince } = this.data;
    const text = currentProvince ? currentProvince.name + ' ' + name : name;
    const data = {
      locationMode: 'manual',
      currentProvince,
      currentCity: { code, name },
      currentDistrict: null,
      locationText: text,
    };
    this.setData({ ...data, showPicker: false });
    this.saveLocation(data);
  },

  // ========== 选择区县（仅直辖市） ==========
  onDistrictSelect(e) {
    const { code, name } = e.currentTarget.dataset;
    const { currentProvince } = this.data;
    const data = {
      locationMode: 'manual',
      currentProvince,
      currentCity: null,
      currentDistrict: { code, name },
      locationText: name,
    };
    this.setData({ ...data, showPicker: false });
    this.saveLocation(data);
  },

  onPickerBack() {
    const { pickerStep } = this.data;
    if (pickerStep === 'city') {
      this.setData({
        pickerStep: 'province',
        currentCity: null,
        filteredList: this.data.provinceList,
        searchValue: '',
      });
    } else if (pickerStep === 'district') {
      this.setData({
        pickerStep: 'province',
        currentCity: null,
        currentDistrict: null,
        filteredList: this.data.provinceList,
        searchValue: '',
      });
    }
  },

  onPickerClose() {
    this.setData({ showPicker: false });
  },

  // ========== 表单 ==========
  onDaysChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    this.setData({ days: Math.max(1, Math.min(7, this.data.days + delta)) });
  },

  onBudgetTap(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({ budget: this.data.budget === value ? '' : value });
  },

  onPrefTap(e) {
    const { value } = e.currentTarget.dataset;
    const prefs = this.data.preferences;
    const idx = prefs.indexOf(value);
    if (idx >= 0) this.setData({ preferences: prefs.filter(p => p !== value) });
    else {
      if (prefs.length >= 3) { wx.showToast({ title: '最多选3个', icon: 'none' }); return; }
      this.setData({ preferences: [...prefs, value] });
    }
  },

  onRecommend() {
    const { currentProvince, currentCity, currentDistrict, budget } = this.data;
    if (!currentProvince && !currentCity && !currentDistrict) {
      wx.showToast({ title: '请先选择位置', icon: 'none' }); return;
    }
    if (!budget) { wx.showToast({ title: '请选择人均预算', icon: 'none' }); return; }

    const params = {
      location_mode: this.data.locationMode,
      province: currentProvince?.name || '',
      city: currentCity?.name || '',
      district: currentDistrict?.name || '',
      days: this.data.days,
      budget,
      preferences: this.data.preferences,
    };
    wx.setStorageSync('discover_params', params);
    wx.navigateTo({ url: '/pages/discover/result/result' });
  },
});
