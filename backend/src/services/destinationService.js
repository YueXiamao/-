// 目的地/行政区划服务
import { getDb } from '../db/database.js';

// ── 内存缓存 ──────────────────────────────────────────────────────────────
const _cache = new Map();
const PROV_TTL = 60 * 60 * 1000;   // 省份: 1小时
const CITY_TTL = 10 * 60 * 1000;   // 城市: 10分钟
const DIST_TTL = 10 * 60 * 1000;   // 区县: 10分钟

function cacheGet(key, ttl) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

/**
 * 清除指定缓存，传入 key 前缀或 'all'
 * @param {string} [key] - 缓存key，不传则返回缓存统计
 */
export function clearCache(key) {
  if (!key || key === 'all') { _cache.clear(); return { cleared: 'all' }; }
  let count = 0;
  for (const k of _cache.keys()) { if (k.startsWith(key)) { _cache.delete(k); count++; } }
  return { cleared: key, count };
}

export function cacheStats() {
  return { size: _cache.size, keys: [..._cache.keys()] };
}

class DestinationService {
  get db() {
    return getDb();
  }

  // 获取所有省份（按常用旅游顺序排列）
  async getProvinces() {
    const key = 'provinces';
    const cached = cacheGet(key, PROV_TTL);
    if (cached) return cached;
    const data = this.db.all("SELECT code, name, lat, lng FROM region_data WHERE level = 1 ORDER BY sort_order, name");
    cacheSet(key, data);
    return data;
  }

  // 获取地级市
  async getCities(provinceCode) {
    const key = `cities:${provinceCode}`;
    const cached = cacheGet(key, CITY_TTL);
    if (cached) return cached;
    const data = this.db.all(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 2 AND parent_code = ? ORDER BY name",
      provinceCode
    );
    cacheSet(key, data);
    return data;
  }

  // 获取区县
  async getDistricts(cityCode) {
    const key = `districts:${cityCode}`;
    const cached = cacheGet(key, DIST_TTL);
    if (cached) return cached;
    const data = this.db.all(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 3 AND parent_code = ? ORDER BY name",
      cityCode
    );
    cacheSet(key, data);
    return data;
  }

  // 搜索目的地
  async search(keyword, limit = 10) {
    const q = `%${keyword}%`;
    return this.db.all(
      `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
       FROM destination d
       LEFT JOIN destination_tag dt ON d.id = dt.destination_id
       WHERE d.name LIKE ? OR d.city LIKE ?
       GROUP BY d.id
       ORDER BY d.hot_score DESC
       LIMIT ?`,
      q, q, limit
    );
  }

  // 获取热门目的地
  async getHotDestinations(limit = 20) {
    return this.db.all(
      `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
       FROM destination d
       LEFT JOIN destination_tag dt ON d.id = dt.destination_id
       GROUP BY d.id
       ORDER BY d.hot_score DESC
       LIMIT ?`,
      limit
    );
  }

  // 录入目的地
  async insert(data) {
    const { name, province, city, level, parent_code, latitude, longitude, avg_budget, hot_score } = data;
    return this.db.run(
      `INSERT INTO destination (name, province, city, level, parent_code, latitude, longitude, avg_budget, hot_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name, province, city, level, parent_code, latitude, longitude, avg_budget, hot_score
    );
  }

  // 删除目的地
  async delete(id) {
    return this.db.run("DELETE FROM destination WHERE id = ?", id);
  }
}

export const destinationService = new DestinationService();
