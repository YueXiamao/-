// POI 服务（高德地图封装）
import axios from 'axios';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

// 高德 API 签名
function signAMap(params, secret) {
  const str = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('') + secret;
  return crypto.createHash('md5').update(str).digest('hex');
}

class PoiService {
  // 调用高德 POI 搜索
  async searchAmap({ keyword, type, city, offset = 0, limit = 20 }) {
    const params = {
      key: config.amap.key,
      keywords: keyword,
      types: this.amapTypeMap[type] || type,
      city,
      offset,
      limit,
      output: 'json'
    };

    // 有 secret 的话做签名（Web服务 API）
    if (config.amap.secret) {
      params.sig = signAMap(params, config.amap.secret);
    }

    try {
      const res = await axios.get('https://restapi.amap.com/v3/place/text', { params, timeout: 5000 });
      const data = res.data;

      if (data.status !== '1') {
        throw AppError.AMAP_ERROR(`高德API错误: ${data.info} (${data.infocode})`);
      }

      return (data.pois || []).map(poi => this.normalizePoi(poi, type));
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.AMAP_ERROR('高德API调用失败: ' + err.message);
    }
  }

  // 统一 POI 数据格式
  normalizePoi(poi, type) {
    return {
      poi_id: poi.id,
      name: poi.name,
      address: poi.address || '',
      location: poi.location ? {
        lng: parseFloat(poi.location.split(',')[0]),
        lat: parseFloat(poi.location.split(',')[1])
      } : null,
      tel: poi.tel || '',
      tag: poi.tag || '',
      rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : null,
      open_time: poi.opening_time || '',
      price: poi.biz_ext?.cost ? parseFloat(poi.biz_ext.cost) : null
    };
  }

  // 高德 POI 类型映射
  amapTypeMap = {
    spot: '风景名胜|公园|博物馆|文物古迹',
    food: '餐饮服务|美食',
    hotel: '住宿服务|酒店'
  };

  // 缓存 key
  cacheKey(destination, keyword, type) {
    return `poi:${destination}:${keyword}:${type}`;
  }

  // 带缓存的搜索
  async search({ keyword, type, city, limit = 10 }) {
    const cachePool = mysql.createPool(config.db);

    // 先查缓存
    const [cached] = await cachePool.query(
      `SELECT data FROM poi_cache WHERE destination = ? AND name LIKE ? AND type = ? AND expires_at > NOW() LIMIT ?`,
      [city, `%${keyword}%`, type, limit]
    );

    if (cached.length > 0) {
      await cachePool.end();
      return cached.map(row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
    }

    await cachePool.end();

    // 调用高德
    const pois = await this.searchAmap({ keyword, type, city, limit });

    // 写入缓存（异步，不阻塞返回）
    this.writeCache(city, keyword, type, pois).catch(console.error);

    return pois;
  }

  // 写缓存
  async writeCache(destination, keyword, type, pois) {
    const pool = mysql.createPool(config.db);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (type === 'hotel' ? 1 : type === 'food' ? 3 : 7));

    for (const poi of pois) {
      await pool.query(
        `INSERT INTO poi_cache (poi_id, destination, name, type, data, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), cached_at = NOW(), expires_at = VALUES(expires_at)`,
        [poi.poi_id, destination, poi.name, type, JSON.stringify(poi), expiresAt]
      );
    }

    await pool.end();
  }
}

export const poiService = new PoiService();
