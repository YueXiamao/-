// Redis 缓存层
// 当 REDIS_ENABLED=true 时自动连接，提供 get/set/del/clear 接口
// Service 层通过 import { cache } from 引入使用（可选，非强制）

import Redis from 'ioredis';
import { config } from '../config/index.js';

/** @type {Redis|null} */
let redisClient = null;

const isEnabled = () => config.redis && config.redis.enabled === true;

export async function initCache() {
  if (!isEnabled()) {
    console.log('[Cache] Redis 已禁用（REDIS_ENABLED=false），缓存功能跳过');
    return null;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db || 0,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Cache] Redis 重连超过3次，禁用缓存');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true
    });

    await redisClient.connect();
    console.log(`[Cache] Redis 已连接: ${config.redis.host}:${config.redis.port}`);

    redisClient.on('error', (err) => {
      console.error('[Cache] Redis 错误:', err.message);
    });

    return redisClient;
  } catch (err) {
    console.warn('[Cache] Redis 连接失败，缓存功能跳过:', err.message);
    redisClient = null;
    return null;
  }
}

/**
 * 获取缓存
 * @param {string} key
 * @returns {Promise<any|null>} 自动反序列化，失败返回 null
 */
export async function cacheGet(key) {
  if (!redisClient) return null;
  try {
    const val = await redisClient.get(key);
    if (val === null) return null;
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * 设置缓存
 * @param {string} key
 * @param {any} value - 会自动 JSON.stringify
 * @param {number} ttlSeconds - 过期秒数，默认 30 分钟
 */
export async function cacheSet(key, value, ttlSeconds = 1800) {
  if (!redisClient) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.warn('[Cache] SET 失败:', err.message);
  }
}

/**
 * 删除缓存
 * @param {string} key
 */
export async function cacheDel(key) {
  if (!redisClient) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.warn('[Cache] DEL 失败:', err.message);
  }
}

/**
 * 清除指定前缀的所有 key（用于切换城市等场景）
 * @param {string} prefix
 */
export async function cacheClear(prefix) {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`[Cache] 已清除 ${keys.length} 个 key（前缀: ${prefix}）`);
    }
  } catch (err) {
    console.warn('[Cache] CLEAR 失败:', err.message);
  }
}

/**
 * 构建 POI 搜索缓存 key
 * @param {Object} params
 */
export function buildPoiCacheKey({ keyword, city, type, limit = 10 }) {
  return `poi:search:${city}:${type || 'all'}:${keyword}:${limit}`;
}

/**
 * 构建行政区划缓存 key
 * @param {number} level 1=省 2=市 3=区县
 * @param {string} parentCode
 */
export function buildRegionCacheKey(level, parentCode = '') {
  return `region:l${level}:${parentCode || 'root'}`;
}

export function getRedisClient() {
  return redisClient;
}
