import destinationsApi from '../../../services/destinations.js';
import { debounce } from '../../../utils/index.js';
import { getCityBackground } from '../../../constants/index.js';

Page({
  data: {
    searchValue: '',
    searchResults: [],
    showSearch: false,

    selectedDestinations: [],
    maxDestinations: 5,

    provinces: [],
    cities: [],
    districts: [],

    selectedProvince: null,
    selectedCity: null,

    step: 1,
    loading: false,
    pageBackground: getCityBackground()
  },

  onLoad() {
    this.loadProvinces();
  },

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

  onProvinceTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      selectedProvince: { code, name },
      selectedCity: null,
      districts: [],
      pageBackground: getCityBackground([name]),
      step: 2
    });
    this.loadCities(code);
  },

  onCityTap(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({
      selectedCity: { code, name },
      districts: [],
      pageBackground: getCityBackground([name]),
      step: 3
    });
    this.loadDistricts(code);
  },

  onCityConfirm(e) {
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

  addDestination(dest) {
    const { selectedDestinations, maxDestinations } = this.data;

    if (selectedDestinations.length >= maxDestinations) {
      wx.showToast({ title: `最多选择${maxDestinations}个`, icon: 'none' });
      return;
    }

    const exists = selectedDestinations.some(d => d.name === dest.name);
    if (exists) {
      wx.showToast({ title: '已添加', icon: 'none' });
      return;
    }

    const nextDestinations = [...selectedDestinations, dest];
    this.setData({
      selectedDestinations: nextDestinations,
      pageBackground: getCityBackground(nextDestinations)
    });
  },

  onDestRemove(e) {
    const { index } = e.currentTarget.dataset;
    const list = [...this.data.selectedDestinations];
    list.splice(index, 1);
    this.setData({
      selectedDestinations: list,
      pageBackground: getCityBackground(list)
    });
  },

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
