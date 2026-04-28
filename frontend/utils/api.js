import { API_TEST_URL } from '../constants/index.js';

const BASE_URL = API_TEST_URL || 'http://localhost:3000';

function request(url, method, data, header = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

export function get(url, data, header) {
  return request(url, 'GET', data, header);
}

export function post(url, data, header) {
  return request(url, 'POST', data, header);
}

export default { get, post };
