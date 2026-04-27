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
  request(path, data = {}, method = 'GET', header = {}) {
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
            // 兼容两种格式：{ code: 0, data: [...] } 或直接返回 [...]
            if (typeof res.data === 'object' && !Array.isArray(res.data)) {
              if (res.data.code === 0 || res.data.code === undefined) {
                resolve(res.data.data !== undefined ? res.data.data : res.data);
              } else {
                wx.showToast({ title: res.data.message || '请求失败', icon: 'none', duration: 2000 });
                reject({
                  ...(typeof res.data === 'object' && res.data ? res.data : {}),
                  statusCode: res.statusCode
                });
              }
            } else {
              // 直接返回数组
              resolve(res.data);
            }
          } else if (res.statusCode === 401) {
            // 未登录，清除 openid 重新登录
            wx.removeStorageSync('openid');
            wx.showToast({ title: '请重新登录', icon: 'none' });
            reject({
              ...(typeof res.data === 'object' && res.data ? res.data : {}),
              statusCode: res.statusCode
            });
          } else {
            wx.showToast({
              title: `网络错误 (${res.statusCode})`,
              icon: 'none'
            });
            reject({
              ...(typeof res.data === 'object' && res.data ? res.data : {}),
              statusCode: res.statusCode
            });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: '网络错误，请检查网络',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  }

  // GET 请求
  get(path, data) {
    return this.request(path, data, 'GET');
  }

  // POST 请求
  post(path, data) {
    return this.request(path, data, 'POST');
  }

  // PATCH 请求
  patch(path, data) {
    return this.request(path, data, 'PATCH');
  }

  // DELETE 请求
  delete(path, data) {
    return this.request(path, data, 'DELETE');
  }
}

// 导出单例
export const api = new ApiService();

// 导出常用请求方法
export const get = (path, data) => api.get(path, data);
export const post = (path, data) => api.post(path, data);
export const patch = (path, data) => api.patch(path, data);
export const del = (path, data) => api.delete(path, data);
