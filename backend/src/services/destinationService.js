// 目的地/行政区划服务
import { getDb } from '../db/database.js';

class DestinationService {
  get db() {
    return getDb();
  }

  // 获取所有省份（按常用旅游顺序排列）
  async getProvinces() {
    return this.db.all("SELECT code, name, lat, lng FROM region_data WHERE level = 1 ORDER BY sort_order, name");
  }

  // 获取地级市
  async getCities(provinceCode) {
    return this.db.all(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 2 AND parent_code = ? ORDER BY name",
      provinceCode
    );
  }

  // 获取区县
  async getDistricts(cityCode) {
    return this.db.all(
      "SELECT code, name, lat, lng FROM region_data WHERE level = 3 AND parent_code = ? ORDER BY name",
      cityCode
    );
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
