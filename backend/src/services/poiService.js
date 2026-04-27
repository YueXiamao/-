// POI 服务（高德地图 API 封装）
import axios from 'axios';
import { getDb } from '../db/database.js';
import { config } from '../config/index.js';

const AMAP_BASE = 'https://restapi.amap.com/v3';

// 高德 type -> 我们内部 type 的映射
const TYPE_MAP = {
  spot: '',
  food: '餐饮服务',
  hotel: '住宿'
};

class PoiService {
  get db() {
    return getDb();
  }

  // 搜索 POI
  async search({ keyword, type = 'spot', city, limit = 10 }) {
    try {
      const res = await axios.get(`${AMAP_BASE}/place/text`, {
        params: {
          key: config.amap.key,
          keywords: keyword,
          city: city || undefined,
          types: TYPE_MAP[type] || undefined,
          offset: limit,
          page: 1,
          output: 'json'
        },
        timeout: 8000,
        proxy: false
      });

      if (res.data.status !== '1' || !res.data.pois) {
        console.error('高德 API 错误:', res.data.info);
        return [];
      }

      return res.data.pois.map(p => ({
        gaode_id: p.id,
        name: p.name,
        address: p.address || '',
        type,
        city: p.cityname || city || '',
        latitude: p.location ? parseFloat(p.location.split(',')[1]) : null,
        longitude: p.location ? parseFloat(p.location.split(',')[0]) : null,
        rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : null,
        price: p.biz_ext?.cost ? parseFloat(p.biz_ext.cost) : null,
        photos: p.photos ? p.photos.map(ph => ph.url) : [],
        tags: p.type ? p.type.split(';') : []
      }));
    } catch (err) {
      console.error('POI 搜索失败:', err.message);
      return [];
    }
  }

  // 获取POI详情
  async getDetail(gaodeId) {
    try {
      const res = await axios.get(`${AMAP_BASE}/place/detail`, {
        params: {
          key: config.amap.key,
          id: gaodeId,
          output: 'json'
        },
        timeout: 8000
      });

      if (res.data.status !== '1' || !res.data.pois?.[0]) {
        return null;
      }

      return res.data.pois[0];
    } catch (err) {
      console.error('POI 详情获取失败:', err.message);
      return null;
    }
  }

  // 缓存 POI 到数据库
  cachePois(pois) {
    if (!pois || pois.length === 0) return;

    const upsert = this.db.prepare(`
      INSERT INTO poi (gaode_id, name, address, type, city, latitude, longitude, rating, price, photos, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(gaode_id) DO UPDATE SET
        name = excluded.name,
        address = excluded.address,
        rating = COALESCE(excluded.rating, rating),
        price = COALESCE(excluded.price, price)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const p of items) {
        upsert.run(
          p.gaode_id, p.name, p.address || '', p.type, p.city,
          p.latitude, p.longitude, p.rating, p.price,
          JSON.stringify(p.photos || []), JSON.stringify(p.tags || [])
        );
      }
    });

    insertMany(pois);
  }

  // 从缓存查 POI
  getCachedPois(city, type, limit = 20) {
    const stmt = this.db.prepare(`
      SELECT * FROM poi WHERE city = ? AND type = ?
      ORDER BY rating DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(city, type, limit);
  }
}

export const poiService = new PoiService();
