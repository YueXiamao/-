import { API_BASE_URL, API_DEVTOOLS_URL, API_TEST_URL } from '../constants/index.js';

export function resolveApiBaseUrl(wxApi = globalThis.wx) {
  const envVersion = wxApi?.getAccountInfoSync?.()?.miniProgram?.envVersion;
  if (envVersion === 'release') {
    return API_BASE_URL;
  }

  const platform = String(wxApi?.getSystemInfoSync?.()?.platform || '').toLowerCase();
  const isDesktopDevtools = platform === 'windows' || platform === 'mac';
  return isDesktopDevtools ? API_DEVTOOLS_URL : API_TEST_URL;
}

function parseRequestError(err = {}) {
  const message = String(err.errMsg || '');
  if (message.includes('timeout') || message.includes('超时')) {
    return { type: 'timeout', message: '请求超时，请检查网络' };
  }
  if (
    message.includes('econnrefused') ||
    message.includes('unable to connect') ||
    message.includes('request:fail')
  ) {
    return { type: 'offline', message: '无法连接服务器，请确认后端已启动' };
  }
  return { type: 'network', message: '网络异常，请检查网络连接' };
}

class ApiService {
  constructor(wxApi = globalThis.wx) {
    this.wxApi = wxApi;
    this.baseUrl = resolveApiBaseUrl(wxApi);
  }

  getOpenid() {
    return this.wxApi?.getStorageSync?.('openid');
  }

  request(path, data = {}, method = 'GET', header = {}, options = {}) {
    return new Promise((resolve, reject) => {
      const openid = this.getOpenid();
      this.baseUrl = resolveApiBaseUrl(this.wxApi);

      this.wxApi.request({
        url: this.baseUrl + path,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          'X-OpenID': openid || '',
          ...header
        },
        timeout: options.timeout || 15000,
        success: (res) => {
          if (res.statusCode === 200) {
            if (typeof res.data === 'object' && !Array.isArray(res.data)) {
              if ('code' in res.data) {
                if (res.data.code === 0) {
                  resolve(res.data.data !== undefined ? res.data.data : res.data);
                } else {
                  if (!options.silent) {
                    this.wxApi.showToast({
                      title: res.data.message || '请求失败',
                      icon: 'none',
                      duration: 2000
                    });
                  }
                  reject({ ...res.data, statusCode: res.statusCode });
                }
              } else {
                resolve(res.data.data !== undefined ? res.data.data : res.data);
              }
            } else {
              resolve(res.data);
            }
            return;
          }

          if (res.statusCode === 401) {
            this.wxApi.removeStorageSync('openid');
            if (!options.silent) {
              this.wxApi.showToast({ title: '请重新登录', icon: 'none' });
            }
            reject({
              ...(typeof res.data === 'object' && res.data ? res.data : {}),
              statusCode: res.statusCode
            });
            return;
          }

          if (!options.silent) {
            this.wxApi.showToast({
              title: `服务器错误(${res.statusCode})`,
              icon: 'none'
            });
          }
          reject({
            ...(typeof res.data === 'object' && res.data ? res.data : {}),
            statusCode: res.statusCode
          });
        },
        fail: (err) => {
          const parsed = parseRequestError(err);
          if (!options.silent) {
            this.wxApi.showToast({ title: parsed.message, icon: 'none' });
          }
          reject({
            ...err,
            _apiErrorType: parsed.type,
            _apiErrorMsg: parsed.message
          });
        }
      });
    });
  }

  get(path, data, options) {
    return this.request(path, data, 'GET', {}, options);
  }

  post(path, data, options) {
    return this.request(path, data, 'POST', {}, options);
  }

  patch(path, data, options) {
    return this.request(path, data, 'PATCH', {}, options);
  }

  delete(path, data, options) {
    return this.request(path, data, 'DELETE', {}, options);
  }
}

export const api = new ApiService();
export { ApiService };
export const get = (path, data, options) => api.get(path, data, options);
export const post = (path, data, options) => api.post(path, data, options);
export const patch = (path, data, options) => api.patch(path, data, options);
export const del = (path, data, options) => api.delete(path, data, options);
