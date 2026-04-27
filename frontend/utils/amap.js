/**
 * 高德地图 POI 封装层
 *
 * 职责：
 * 1. 重试机制 — 网络抖动/超时时最多重试 2 次
 * 2. 本地缓存 — 热门城市 POI 缓存 30 分钟，避免重复请求
 * 3. 错误归类 — 将请求错误分为「可重试」和「不可重试」两类
 * 4. 类型转换 — 统一后端返回的 POI 字段格式，供前端页面直接使用
 *
 * 调用链：页面 → utils/amap.js → services/pois.js → 后端 → 高德
 */

import poisService from '../services/pois.js';

// -----------------------------------------------
// 配置
// -----------------------------------------------

const CACHE_TTL = 30 * 60 * 1000;      // 缓存有效期 30 分钟
const CACHE_KEY_PREFIX = 'amap_poi_';  // Storage key 前缀
const MAX_RETRIES = 2;                 // 最多重试次数

// -----------------------------------------------
// 错误归类
// -----------------------------------------------

/**
 * 判断 POI 请求错误是否可重试
 * @param {any} err
 * @returns {boolean}
 */
export function isPoiRetryableError(err) {
  if (!err) return false;
  const msg = String(err.errMsg || err.message || err.code || '').toLowerCase();
  return (
    err.statusCode === 503 ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNREFUSED' ||
    msg.includes('timeout') ||
    msg.includes('request:fail') ||
    msg.includes('network error')
  );
}

/**
 * 获取用户友好的 POI 错误提示
 * @param {any} err
 * @returns {string}
 */
export function getPoiErrorMessage(err) {
  if (isPoiRetryableError(err)) {
    return 'POI 服务繁忙，请稍后重试';
  }
  return '无法获取地点信息，请检查网络后重试';
}

// -----------------------------------------------
// 缓存读写
// -----------------------------------------------

/**
 * 生成缓存 key
 * @param {string} keyword
 * @param {string} type
 * @param {string} city
 * @returns {string}
 */
function makeCacheKey(keyword, type, city) {
  return `${CACHE_KEY_PREFIX}${city || 'all'}_${type}_${keyword}`;
}

/**
 * 从 Storage 读取缓存，校验 TTL
 * @param {string} key
 * @returns {object[]|null}
 */
function getFromCache(key) {
  try {
    const raw = wx.getStorageSync(key);
    if (!raw) return null;
    const { data, timestamp } = raw;
    if (Date.now() - timestamp > CACHE_TTL) {
      wx.removeStorageSync(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * 写入 Storage，带时间戳
 * @param {string} key
 * @param {object[]} data
 */
function saveToCache(key, data) {
  try {
    wx.setStorageSync(key, { data, timestamp: Date.now() });
  } catch {
    // Storage 写失败不影响流程
  }
}

// -----------------------------------------------
// 类型转换（后端字段 → 前端统一格式）
// -----------------------------------------------

/**
 * 将后端返回的 POI 记录转换为前端标准格式
 * 兼容两种情况：
 *   - 后端返回字段（gaode_id / name / address / ...）
 *   - 直接从高德 API 来的字段（id / name / address / location / ...）
 *
 * @param {object} p 后端 POI 记录
 * @returns {object} 前端标准 POI 格式
 */
export function normalizePoi(p) {
  if (!p) return null;

  // 兼容两种 location 格式
  let lat = null, lng = null;
  if (p.latitude != null && p.longitude != null) {
    lat = parseFloat(p.latitude);
    lng = parseFloat(p.longitude);
  } else if (p.location) {
    const parts = p.location.split(',');
    if (parts.length === 2) {
      lng = parseFloat(parts[0]);
      lat = parseFloat(parts[1]);
    }
  }

  // 兼容两种 ID 格式
  const id = p.gaode_id || p.id || '';

  return {
    id,
    gaodeId: id,
    name: p.name || '',
    address: p.address || p.pguidance || '',
    type: p.type || 'spot',
    city: p.city || '',
    latitude: isNaN(lat) ? null : lat,
    longitude: isNaN(lng) ? null : lng,
    rating: p.rating != null ? parseFloat(p.rating) : null,
    price: p.price != null ? parseFloat(p.price) : null,
    photos: Array.isArray(p.photos) ? p.photos : [],
    tags: Array.isArray(p.tags) ? p.tags : (p.tag ? [p.tag] : [])
  };
}

/**
 * 批量转换 POI 数组
 * @param {object[]|null} list
 * @returns {object[]}
 */
export function normalizePoiList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizePoi).filter(Boolean);
}

// -----------------------------------------------
// 核心搜索方法（带重试 + 缓存）
// -----------------------------------------------

/**
 * 搜索 POI（带缓存、错误处理、友好提示）
 *
 * @param {object} params
 * @param {string}   params.keyword  - 搜索关键词
 * @param {string}   [params.type='spot'] - POI 类型：spot | food | hotel
 * @param {string}   [params.city]   - 限定城市
 * @param {number}   [params.limit=10] - 返回数量
 * @param {boolean}  [params.useCache=true] - 是否读缓存（默认 true，强制刷新时设 false）
 * @param {number}   [params.retryCount=0]  - 当前重试次数，内部使用
 * @returns {Promise<{ pois: object[], fromCache: boolean }>}
 *
 * @example
 *   const { pois, fromCache } = await searchPois({ keyword: '火锅', city: '成都', type: 'food' });
 */
export async function searchPois({
  keyword = '',
  type = 'spot',
  city = '',
  limit = 10,
  useCache = true,
  retryCount = 0
}) {
  // 1. 读缓存（不走网络）
  if (useCache && retryCount === 0) {
    const cacheKey = makeCacheKey(keyword, type, city);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { pois: normalizePoiList(cached), fromCache: true };
    }
  }

  // 2. 发请求，带重试
  try {
    const raw = await poisService.search({ keyword, type, city, limit });

    if (!raw || raw.length === 0) {
      return { pois: [], fromCache: false };
    }

    // 3. 写入缓存
    const cacheKey = makeCacheKey(keyword, type, city);
    saveToCache(cacheKey, raw);

    return { pois: normalizePoiList(raw), fromCache: false };

  } catch (err) {
    // 3. 可重试错误，最多 MAX_RETRIES 次
    if (isPoiRetryableError(err) && retryCount < MAX_RETRIES) {
      console.warn(`[amap] POI 请求超时，第 ${retryCount + 1} 次重试...`);
      return searchPois({ keyword, type, city, limit, useCache: false, retryCount: retryCount + 1 });
    }

    // 4. 不可重试或已达上限，抛统一格式错误
    const error = new Error(getPoiErrorMessage(err));
    error.retryable = isPoiRetryableError(err);
    error.causedBy = err;
    throw error;
  }
}

// -----------------------------------------------
// 同步简化接口（用于页面直接使用）
// -----------------------------------------------

/**
 * 同步搜索 POI（无缓存，用于搜索联想等实时场景）
 * 错误由调用方自行处理
 *
 * @param {object} params
 * @returns {Promise<object[]>}
 */
export async function quickSearch({ keyword, type = 'spot', city = '', limit = 5 }) {
  const raw = await poisService.search({ keyword, type, city, limit });
  return normalizePoiList(raw || []);
}

// -----------------------------------------------
// 清除 POI 缓存（供外部调用，如切换城市后）
// -----------------------------------------------

/**
 * 清除所有 POI 缓存
 */
export function clearPoiCache() {
  try {
    const info = wx.getStorageInfoSync();
    if (!info || !info.keys) return;
    for (const key of info.keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        wx.removeStorageSync(key);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 清除指定关键词的 POI 缓存
 * @param {string} keyword
 * @param {string} type
 * @param {string} city
 */
export function clearPoiCacheFor(keyword, type, city) {
  try {
    wx.removeStorageSync(makeCacheKey(keyword, type, city));
  } catch {
    // ignore
  }
}

// -----------------------------------------------
// 导出常量供外部参考
// -----------------------------------------------

export const POI_TYPE_LABELS = {
  spot: '景点',
  food: '美食',
  hotel: '住宿'
};

export const POI_TYPE_ICONS = {
  spot: '/assets/icons/poi-spot.png',
  food: '/assets/icons/poi-food.png',
  hotel: '/assets/icons/poi-hotel.png'
};
