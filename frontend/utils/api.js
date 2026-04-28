import { api } from '../services/api.js';

function request(url, method, data, header = {}) {
  return api.request(url, data, method, header);
}

export function get(url, data, header) {
  return request(url, 'GET', data, header);
}

export function post(url, data, header) {
  return request(url, 'POST', data, header);
}

export default { get, post };
