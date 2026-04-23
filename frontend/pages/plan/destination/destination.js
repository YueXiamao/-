// pages/plan/destination/destination.js
import destinationsApi from '../../../services/destinations.js';
import { debounce } from '../../../utils/index.js';

Page({
  data: {
    // 搜索
    searchValue: '',
    searchResults: [],
    showSearch: false,

    // 已选目的地
    selectedDestinations: [],
    maxDestinations: 5,

    // 行政区划数据
    provinces: [],
    cities: [],
    districts: [],

    // 当前选择路径（用于显示 "四川 > 成都" 这类信息）
    selectedProvince: null,
    selectedCity: null,

    // UI 状态：1省 2市 3区县（选了区县后保持3，不再跳回2）
    step: 1,
    loading: false
  },

  onLoad() {
    this.loadProvinces();
  },

  // ---------- 加载 ----------
  async loadProvinces() {
    this.setData({ loading: true });
    try {
      const provinces = await destinationsApi.getProvinces();
      this.setData({ provinces, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载省份失败', icon: 'none' });
    }
  },

  async loadCities(provinceCode) {
    this.setData({ loading: true });
    try {
      const cities = await destinationsApi.getCities(provinceCode);
      this.setData({ cities, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载城市失败', icon: 'none' });
    }
  },

  async loadDistricts(cityCode) {
    this.setData({ loading: true });
    try {
      const districts = await destinationsApi.getDistricts(cityCode);
      this.setData({ districts, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载区县失败', icon: 'none' });
    }
  },

  // ---------- 选择事件 ----------
  onProvinceTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      selectedProvince: { code, name },
      selectedCity: null,
      districts: [],
      step: 2
    });
    this.loadCities(code);
  },

  // 点城市名进入区县列表；点"直接选市"按钮只加城市
  onCityTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      selectedCity: { code, name },
      districts: [],
      step: 3
    });
    this.loadDistricts(code);
  },

  onCityConfirm(e) {
    // 阻止冒泡，避免触发 onCityTap
    e.stopPropagation && e.stopPropagation();
    const { code, name } = e.currentTarget.dataset;
    this.addDestination({
      name,
      code,
      city: name,
      province: this.data.selectedProvince.name,
      level: 'city'
    });
  },

  onDistrictTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.addDestination({
      name,
      code,
      city: this.data.selectedCity.name,
      province: this.data.selectedProvince.name,
      level: 'district'
    });
  },

  // ---------- 通用添加逻辑 ----------
  addDestination(dest) {
    const { selectedDestinations, maxDestinations } = this.data;

    if (selectedDestinations.length >= maxDestinations) {
      wx.showToast({ title: `最多选${maxDestinations}个`, icon: 'none' });
      return;
    }
    const exists = selectedDestinations.some(d => d.name === dest.name);
    if (exists) {
      wx.showToast({ title: '已添加', icon: 'none' });
      return;
    }

    this.setData({
      selectedDestinations: [...selectedDestinations, dest]
      // 注意：step 保持 3，不跳转，用户可以继续选更多区县
    });
  },

  // 删除已选
  onDestRemove(e) {
    const { index } = e.currentTarget.dataset;
    const list = [...this.data.selectedDestinations];
    list.splice(index, 1);
    this.setData({ selectedDestinations: list });
  },

  // ---------- 搜索 ----------
  onSearchInput(e) {
    const value = e.detail.value;
    this.setData({ searchValue: value });
    if (value.length >= 2) {
      this._debounceSearch(value);
    } else {
      this.setData({ searchResults: [], showSearch: false });
    }
  },

  _debounceSearch: debounce(async function (value) {
    try {
      const results = await destinationsApi.search(value);
      this.setData({ searchResults: results, showSearch: true });
    } catch (e) {
      console.error('搜索失败', e);
    }
  }, 300),

  onSearchResultTap(e) {
    const { name, code, level, province, city } = e.currentTarget.dataset;
    this.addDestination({ name, code, level, province, city });
    this.setData({ searchValue: '', searchResults: [], showSearch: false });
  },

  onSearchClose() {
    this.setData({ searchValue: '', searchResults: [], showSearch: false });
  },

  // ---------- 导航 ----------
  onBackStep() {
    const { step } = this.data;
    if (step === 3) {
      this.setData({ step: 2, selectedCity: null, districts: [] });
    } else if (step === 2) {
      this.setData({ step: 1, selectedProvince: null, cities: [] });
    }
  },

  onNext() {
    const { selectedDestinations } = this.data;
    if (selectedDestinations.length === 0) {
      wx.showToast({ title: '请至少选择一个目的地', icon: 'none' });
      return;
    }
    wx.setStorageSync('trip_destinations', selectedDestinations);
    wx.navigateTo({ url: '/pages/plan/params/params' });
  }
});
