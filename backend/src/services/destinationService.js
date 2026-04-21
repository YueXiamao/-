// 行政区划服务
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

// 内存缓存行政区划数据（启动时加载一次）
let regionCache = null;

class DestinationService {
  // 初始化/加载行政区划数据
  async loadRegionData() {
    if (regionCache) return regionCache;

    const pool = mysql.createPool(config.db);
    const [rows] = await pool.query('SELECT * FROM region_data ORDER BY level, code');
    await pool.end();

    // 按层级组织数据
    const provinces = [];
    const citiesMap = {};
    const districtsMap = {};

    for (const row of rows) {
      if (row.level === 1) {
        provinces.push({ code: row.code, name: row.name });
        citiesMap[row.code] = [];
      } else if (row.level === 2) {
        citiesMap[row.parent_code]?.push({ code: row.code, name: row.name });
        districtsMap[row.code] = [];
      } else if (row.level === 3) {
        districtsMap[row.parent_code]?.push({ code: row.code, name: row.name });
      }
    }

    regionCache = { provinces, citiesMap, districtsMap };
    return regionCache;
  }

  // 获取所有省份
  async getProvinces() {
    const data = await this.loadRegionData();
    return data.provinces;
  }

  // 获取某省下地级市
  async getCities(provinceCode) {
    const data = await this.loadRegionData();
    return data.citiesMap[provinceCode] || [];
  }

  // 获取某市下区县
  async getDistricts(cityCode) {
    const data = await this.loadRegionData();
    return data.districtsMap[cityCode] || [];
  }

  // 搜索市/县（模糊匹配）
  async search(keyword, limit = 10) {
    const pool = mysql.createPool(config.db);
    const [rows] = await pool.query(
      `SELECT * FROM region_data WHERE name LIKE ? AND level IN (2,3) LIMIT ?`,
      [`%${keyword}%`, limit]
    );
    await pool.end();

    return rows.map(row => ({
      code: row.code,
      name: row.name,
      level: row.level === 2 ? 'city' : 'district',
      province: row.parent_code,
      city: row.level === 3 ? row.parent_code : ''
    }));
  }
}

export const destinationService = new DestinationService();
