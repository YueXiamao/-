// components/region-picker/index.js
Component({
  properties: {
    value: {
      type: Object,
      value: {}
    }
  },

  data: {
    provinces: [],
    cities: [],
    districts: [],
    selectedProvince: null,
    selectedCity: null,
    selectedDistrict: null,
    step: 1
  },

  methods: {
    // 选择省
    onProvinceTap(e) {
      const { code, name } = e.currentTarget.dataset;
      this.setData({
        selectedProvince: { code, name },
        selectedCity: null,
        selectedDistrict: null,
        step: 2
      });
      this.triggerEvent('change', {
        province: this.data.selectedProvince,
        city: null,
        district: null
      });
    },

    // 选择市
    onCityTap(e) {
      const { code, name } = e.currentTarget.dataset;
      this.setData({
        selectedCity: { code, name },
        selectedDistrict: null,
        step: 3
      });
      this.triggerEvent('change', {
        province: this.data.selectedProvince,
        city: this.data.selectedCity,
        district: null
      });
    },

    // 选择区县
    onDistrictTap(e) {
      const { code, name } = e.currentTarget.dataset;
      this.setData({ selectedDistrict: { code, name } });
      this.triggerEvent('change', {
        province: this.data.selectedProvince,
        city: this.data.selectedCity,
        district: this.data.selectedDistrict
      });
    },

    // 上一步
    onBack() {
      if (this.data.step === 3) {
        this.setData({ step: 2, selectedDistrict: null });
      } else if (this.data.step === 2) {
        this.setData({ step: 1, selectedCity: null });
      }
    }
  }
});
