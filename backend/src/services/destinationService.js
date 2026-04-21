// 目的地/行政区划服务
import { getDb } from '../db/database.js';

class DestinationService {
  get db() {
    return getDb();
  }

  // 获取所有省份
  getProvinces() {
    const stmt = this.db.prepare(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 1 ORDER BY name"
    );
    return stmt.all();
  }

  // 获取地级市
  getCities(provinceCode) {
    const stmt = this.db.prepare(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 2 AND parent_code = ? ORDER BY name"
    );
    return stmt.all(provinceCode);
  }

  // 获取区县
  getDistricts(cityCode) {
    const stmt = this.db.prepare(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 3 AND parent_code = ? ORDER BY name"
    );
    return stmt.all(cityCode);
  }

  // 搜索目的地
  search(keyword, limit = 10) {
    const stmt = this.db.prepare(
      `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
       FROM destination d
       LEFT JOIN destination_tag dt ON d.id = dt.destination_id
       WHERE d.name LIKE ? OR d.city LIKE ?
       GROUP BY d.id
       ORDER BY d.hot_score DESC
       LIMIT ?`
    );
    const q = `%${keyword}%`;
    return stmt.all(q, q, limit);
  }

  // 获取热门目的地
  getHotDestinations(limit = 20) {
    const stmt = this.db.prepare(
      `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
       FROM destination d
       LEFT JOIN destination_tag dt ON d.id = dt.destination_id
       GROUP BY d.id
       ORDER BY d.hot_score DESC
       LIMIT ?`
    );
    return stmt.all(limit);
  }

  // 录入目的地
  insert(data) {
    const { name, province, city, level, parent_code, latitude, longitude, avg_budget, hot_score } = data;
    const stmt = this.db.prepare(`
      INSERT INTO destination (name, province, city, level, parent_code, latitude, longitude, avg_budget, hot_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, province, city, level, parent_code || '', latitude, longitude, avg_budget, hot_score || 0);
    return result.lastInsertRowid;
  }

  // 批量录入（带事务）
  insertBatch(items) {
    const insert = this.db.prepare(`
      INSERT INTO destination (name, province, city, level, parent_code, latitude, longitude, avg_budget, hot_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTag = this.db.prepare(
      "INSERT INTO destination_tag (destination_id, tag) VALUES (?, ?)"
    );

    const transaction = this.db.transaction((records) => {
      for (const item of records) {
        const r = insert.run(
          item.name, item.province, item.city, item.level || 'city',
          item.parent_code || '', item.latitude, item.longitude,
          item.avg_budget, item.hot_score || 0
        );
        if (item.tags && Array.isArray(item.tags)) {
          for (const tag of item.tags) {
            insertTag.run(r.lastInsertRowid, tag);
          }
        }
      }
    });

    transaction(items);
  }
}

export const destinationService = new DestinationService();
