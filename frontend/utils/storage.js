// 本地存储工具
export default {
  // 设置
  set(key, value) {
    wx.setStorageSync(key, value);
  },

  // 获取
  get(key, defaultValue = null) {
    return wx.getStorageSync(key) || defaultValue;
  },

  // 删除
  remove(key) {
    wx.removeStorageSync(key);
  },

  // 清空
  clear() {
    wx.clearStorageSync();
  },

  // 行程参数（跨页面传递）
  setTripParams(params) {
    this.set('trip_params', params);
  },

  getTripParams() {
    return this.get('trip_params', null);
  },

  removeTripParams() {
    this.remove('trip_params');
  },

  // 随机玩参数
  setDiscoverParams(params) {
    this.set('discover_params', params);
  },

  getDiscoverParams() {
    return this.get('discover_params', null);
  }
};
