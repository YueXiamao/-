// pages/plan/destination/destination.js
const app = getApp();
import destinationsApi from '../../../services/destinations.js';
import { debounce } from '../../../utils/index.js';

Page({
  data: {
    // 搜索
    searchValue: '',
    searchResults: [],

    // 已选目的地
    selectedDestinations: [],
    maxDestinations: 5,

    // 行政区划数据
    provinces: [],
    cities: [],
    districts: [],

    // 当前选择
    selectedProvince: null,
    selectedCity: null,
    selectedDistrict: null,

    // UI 状态
    step: 1, // 1省 2市 3区县
    loading: false,
    showSearch: false
  },

  onLoad() {
    this.loadProvinces();
  },

  // 加载省份
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

  // 选择省份
  onProvinceTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      selectedProvince: { code, name },
      selectedCity: null,
      selectedDistrict: null,
      cities: [],
      districts: [],
      step: 2
    });
    this.loadCities(code);
  },

  // 加载城市
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

  // 选择城市
  onCityTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      selectedCity: { code, name },
      selectedDistrict: null,
      districts: [],
      step: 3
    });
    this.loadDistricts(code);
  },

  // 加载区县
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

  // 选择区县/确认城市
  onDistrictTap(e) {
    const { code, name } = e.currentTarget.dataset;
    const { selectedDestinations, selectedCity, selectedProvince, maxDestinations } = this.data;

    if (selectedDestinations.length >= maxDestinations) {
      wx.showToast({ title: `最多选择${maxDestinations}个目的地`, icon: 'none' });
      return;
    }

    // 添加目的地
    const dest = { name, code, city: selectedCity.name, province: selectedProvince.name };
    const exists = selectedDestinations.some(d => d.name === name);
    if (exists) {
      wx.showToast({ title: '已添加', icon: 'none' });
      return;
    }

    this.setData({
      selectedDestinations: [...selectedDestinations, dest],
      // 重置选择状态
      selectedCity: null,
      selectedDistrict: null,
      districts: [],
      step: 2
    });
  },

  // 直接确认城市（不加区县）
  onCityConfirm() {
    const { selectedDestinations, selectedCity, selectedProvince, maxDestinations } = this.data;
    if (!selectedCity) return;

    if (selectedDestinations.length >= maxDestinations) {
      wx.showToast({ title: `最多选择${maxDestinations}个目的地`, icon: 'none' });
      return;
    }

    const exists = selectedDestinations.some(d => d.name === selectedCity.name);
    if (exists) {
      wx.showToast({ title: '已添加', icon: 'none' });
      return;
    }

    this.setData({
      selectedDestinations: [...selectedDestinations, {
        name: selectedCity.name,
        code: selectedCity.code,
        city: selectedCity.name,
        province: selectedProvince.name
      }],
      selectedCity: null,
      selectedDistrict: null,
      districts: [],
      step: 2
    });
  },

  // 删除已选目的地
  onDestRemove(e) {
    const { index } = e.currentTarget.dataset;
    const list = [...this.data.selectedDestinations];
    list.splice(index, 1);
    this.setData({ selectedDestinations: list });
  },

  // 搜索相关
  onSearchInput(e) {
    const value = e.detail.value;
    this.setData({ searchValue: value });
    if (value.length >= 2) {
      this.debounceSearch(value);
    } else {
      this.setData({ searchResults: [], showSearch: false });
    }
  },

  debounceSearch: debounce(async function(value) {
    try {
      const results = await destinationsApi.search(value);
      this.setData({ searchResults: results, showSearch: true });
    } catch (e) {
      console.error('搜索失败', e);
    }
  }, 300),

  // 添加搜索结果
  onSearchResultTap(e) {
    const { name, code, level, province, city } = e.currentTarget.dataset;
    const { selectedDestinations, maxDestinations } = this.data;

    if (selectedDestinations.length >= maxDestinations) {
      wx.showToast({ title: `最多选择${maxDestinations}个目的地`, icon: 'none' });
      return;
    }

    const exists = selectedDestinations.some(d => d.name === name);
    if (exists) {
      wx.showToast({ title: '已添加', icon: 'none' });
      return;
    }

    this.setData({
      selectedDestinations: [...selectedDestinations, { name, code, level, province, city }],
      searchValue: '',
      searchResults: [],
      showSearch: false
    });
  },

  // 关闭搜索
  onSearchClose() {
    this.setData({ searchValue: '', searchResults: [], showSearch: false });
  },

  // 上一步
  onBackStep() {
    const { step } = this.data;
    if (step === 3) {
      this.setData({ step: 2, selectedDistrict: null });
    } else if (step === 2) {
      this.setData({ step: 1, selectedCity: null });
    }
  },

  // 下一步
  onNext() {
    const { selectedDestinations } = this.data;
    if (selectedDestinations.length === 0) {
      wx.showToast({ title: '请至少选择一个目的地', icon: 'none' });
      return;
    }

    // 存储到本地，跳转到参数页
    wx.setStorageSync('trip_destinations', selectedDestinations);
    wx.navigateTo({
      url: '/pages/plan/params/params'
    });
  }
});
