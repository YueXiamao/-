// API 请求封装
import { API_BASE_URL, API_TEST_URL } from '../constants/index.js';

// 根据环境切换 Base URL
// 开发环境用 localhost，生产用真实域名
const BASE_URL = API_TEST_URL || API_BASE_URL;

class ApiService {
  constructor() {
    this.baseUrl = BASE_URL;
  }

  // 获取 OpenID
  getOpenid() {
    return wx.getStorageSync('openid');
  }

  // 统一请求方法
  request(path, data = {}, method = 'GET', header = {}, options = {}) {
    return new Promise((resolve, reject) => {
      const openid = this.getOpenid();

      wx.request({
        url: this.baseUrl + path,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          'X-OpenID': openid || '',
          ...header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            // 兼容三种格式：
            // 1. { code: 0, data: [...] }         — 标准业务格式
            // 2. { success: true, data: {...} }   — discover/discover等API格式
            // 3. [...]                             — 直接返回数组
            if (typeof res.data === 'object' && !Array.isArray(res.data)) {
              // 有 code 字段（标准业务格式）
              if ('code' in res.data) {
                if (res.data.code === 0) {
                  resolve(res.data.data !== undefined ? res.data.data : res.data);
                } else {
                  if (!options.silent) {
                    wx.showToast({ title: res.data.message || '请求失败', icon: 'none', duration: 2000 });
                  }
                  reject({ ...res.data, statusCode: res.statusCode });
                }
              } else {
                // 无 code 字段，有 success 字段（discover等格式）
                // data 直接就是结果对象/数组
                resolve(res.data.data !== undefined ? res.data.data : res.data);
              }
            } else {
              // 直接返回数组
              resolve(res.data);
            }
          } else if (res.statusCode === 401) {
            // 未登录，清除 openid 重新登录
            wx.removeStorageSync('openid');
            if (!options.silent) {
              wx.showToast({ title: '请重新登录', icon: 'none' });
            }
            reject({
              ...(typeof res.data === 'object' && res.data ? res.data : {}),
              statusCode: res.statusCode
            });
          } else {
            if (!options.silent) {
              wx.showToast({
                title: `网络错误 (${res.statusCode})`,
                icon: 'none'
              });
            }
            reject({
              ...(typeof res.data === 'object' && res.data ? res.data : {}),
              statusCode: res.statusCode
            });
          }
        },
        fail: (err) => {
          if (!options.silent) {
            wx.showToast({
              title: '网络错误，请检查网络',
              icon: 'none'
            });
          }
          reject(err);
        }
      });
    });
  }

  // GET 请求
  get(path, data, options) {
    return this.request(path, data, 'GET', {}, options);
  }

  // POST 请求
  post(path, data, options) {
    return this.request(path, data, 'POST', {}, options);
  }

  // PATCH 请求
  patch(path, data, options) {
    return this.request(path, data, 'PATCH', {}, options);
  }

  // DELETE 请求
  delete(path, data, options) {
    return this.request(path, data, 'DELETE', {}, options);
  }
}

// 导出单例
export const api = new ApiService();

// 导出常用请求方法
export const get = (path, data, options) => api.get(path, data, options);
export const post = (path, data, options) => api.post(path, data, options);
export const patch = (path, data, options) => api.patch(path, data, options);
export const del = (path, data, options) => api.delete(path, data, options);
