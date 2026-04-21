// 行程服务
import { nanoid } from 'nanoid';
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import { poiService } from './poiService.js';
import { aiGenerator } from '../ai/generator.js';
import { userService } from './userService.js';
import { AppError } from '../middleware/errorHandler.js';

class TripService {
  getPool() {
    return mysql.createPool(config.db);
  }

  // 生成行程
  async generate({ destinations, start_date, days, preferences, extra_notes }) {
    // 1. 收集各目的地的 POI
    const allPois = { spots: [], foods: [], hotels: [] };

    for (const dest of destinations) {
      const name = typeof dest === 'string' ? dest : dest.name;
      try {
        const [spots, foods, hotels] = await Promise.all([
          poiService.search({ keyword: name, type: 'spot', city: name, limit: 20 }),
          poiService.search({ keyword: name, type: 'food', city: name, limit: 10 }),
          poiService.search({ keyword: name, type: 'hotel', city: name, limit: 5 })
        ]);
        allPois.spots.push(...spots);
        allPois.foods.push(...foods);
        allPois.hotels.push(...hotels);
      } catch (err) {
        console.error(`POI 获取失败 ${name}:`, err.message);
      }
    }

    // 2. 调用 AI 生成行程
    let itinerary;
    try {
      itinerary = await aiGenerator.generateTrip({
        destinations,
        start_date,
        days,
        preferences,
        extra_notes,
        pois: allPois
      });
    } catch (err) {
      console.error('AI 生成失败，回退到模板:', err.message);
      // 回退到模板（后续实现）
      itinerary = this.getFallbackTemplate(destinations, days);
    }

    // 3. 生成 trip_id 并组装返回
    const tripId = `T${Date.now()}${nanoid(6).toUpperCase()}`;

    return {
      trip_id: tripId,
      title: `${destinations.map(d => typeof d === 'string' ? d : d.name).join('+')}${days}日游`,
      destinations,
      days,
      start_date,
      itinerary
    };
  }

  // 兜底模板（当 AI 不可用时）
  getFallbackTemplate(destinations, days) {
    const result = [];
    const destNames = destinations.map(d => typeof d === 'string' ? d : d.name);

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      result.push({
        day: i + 1,
        date: date.toISOString().split('T')[0],
        items: [
          {
            type: 'spot',
            name: `${destNames[0]}景区${i + 1}`,
            address: '待填充',
            duration: '2小时',
            description: 'AI生成暂时不可用，请稍后再试',
            transport_to_next: ''
          },
          {
            type: 'food',
            name: `${destNames[0]}特色餐厅`,
            address: '待填充',
            budget: '待填充',
            recommend: 'AI生成暂时不可用'
          },
          {
            type: 'hotel',
            name: `${destNames[0]}酒店`,
            address: '待填充',
            budget: '待填充',
            reason: 'AI生成暂时不可用'
          }
        ]
      });
    }

    return result;
  }

  // 保存行程到数据库
  async saveTrip(openid, tripData) {
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) {
      throw AppError.UNAUTHORIZED('用户不存在');
    }

    const pool = this.getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [tripResult] = await conn.query(
        `INSERT INTO trip (user_id, title, destinations, start_date, days, preferences, extra_notes, status, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
        [
          userId,
          tripData.title,
          JSON.stringify(tripData.destinations),
          tripData.start_date,
          tripData.days,
          JSON.stringify(tripData.preferences),
          tripData.extra_notes || '',
          tripData.source || 'plan'
        ]
      );

      const tripId = tripResult.insertId;

      // 插入每日行程
      for (const dayData of tripData.itinerary) {
        const [dayResult] = await conn.query(
          `INSERT INTO trip_day (trip_id, day_number, date, summary) VALUES (?, ?, ?, ?)`,
          [tripId, dayData.day, dayData.date, dayData.summary || '']
        );
        const dayId = dayResult.insertId;

        // 插入单项
        for (let i = 0; i < dayData.items.length; i++) {
          const item = dayData.items[i];
          await conn.query(
            `INSERT INTO trip_item (trip_day_id, type, name, address, description, duration, budget, recommend, transport_to_next, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dayId, item.type, item.name, item.address || '', item.description || '', item.duration || '', item.budget || '', item.recommend || '', item.transport_to_next || '', i]
          );
        }
      }

      await conn.commit();
      await conn.end();
      await pool.end();

      return { trip_id: tripId, title: tripData.title };
    } catch (err) {
      await conn.rollback();
      await conn.end();
      await pool.end();
      throw AppError.INTERNAL_ERROR('保存行程失败: ' + err.message);
    }
  }

  // 获取行程列表
  async getTripList(openid, { source, page, page_size }) {
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) return { list: [], total: 0 };

    const pool = this.getPool();
    const offset = (page - 1) * page_size;
    const where = source ? `AND source = '${source}'` : '';

    const [rows] = await pool.query(
      `SELECT id, title, destinations, start_date, days, preferences, status, source, created_at
       FROM trip WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, page_size, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM trip WHERE user_id = ? ${where}`, [userId]
    );

    await pool.end();

    return {
      list: rows.map(r => ({
        ...r,
        destinations: JSON.parse(r.destinations),
        preferences: JSON.parse(r.preferences)
      })),
      total,
      page,
      page_size
    };
  }

  // 获取行程详情
  async getTripDetail(openid, tripId) {
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) return null;

    const pool = this.getPool();

    const [trips] = await pool.query(
      `SELECT * FROM trip WHERE id = ? AND user_id = ?`, [tripId, userId]
    );

    if (trips.length === 0) {
      await pool.end();
      return null;
    }

    const [days] = await pool.query(
      `SELECT * FROM trip_day WHERE trip_id = ? ORDER BY day_number`, [tripId]
    );

    for (const day of days) {
      const [items] = await pool.query(
        `SELECT * FROM trip_item WHERE trip_day_id = ? ORDER BY sort_order`, [day.id]
      );
      day.items = items;
    }

    await pool.end();

    const trip = trips[0];
    return {
      ...trip,
      destinations: JSON.parse(trip.destinations),
      preferences: JSON.parse(trip.preferences),
      itinerary: days
    };
  }

  // 更新行程单项
  async updateTripItem(openid, tripId, itemId, updates) {
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) throw AppError.UNAUTHORIZED('用户不存在');

    const pool = this.getPool();

    // 验证权限
    const [trips] = await pool.query(`SELECT id FROM trip WHERE id = ? AND user_id = ?`, [tripId, userId]);
    if (trips.length === 0) throw AppError.NOT_FOUND('行程不存在');

    const allowedFields = ['notes', 'sort_order'];
    const setClause = Object.keys(updates)
      .filter(k => allowedFields.includes(k))
      .map(k => `${k} = ?`)
      .join(', ');

    if (setClause) {
      await pool.query(
        `UPDATE trip_item ti
         JOIN trip_day td ON ti.trip_day_id = td.id
         SET ${setClause}
         WHERE ti.id = ? AND td.trip_id = ?`,
        [...Object.values(updates), itemId, tripId]
      );
    }

    await pool.end();
    return { success: true };
  }

  // 删除行程
  async deleteTrip(openid, tripId) {
    const userId = await userService.getUserIdByOpenid(openid);
    if (!userId) throw AppError.UNAUTHORIZED('用户不存在');

    const pool = this.getPool();
    const [result] = await pool.query(
      `DELETE FROM trip WHERE id = ? AND user_id = ?`, [tripId, userId]
    );
    await pool.end();

    if (result.affectedRows === 0) {
      throw AppError.NOT_FOUND('行程不存在');
    }

    return { success: true };
  }

  // 导出行程（文字格式）
  async exportTrip(openid, tripId) {
    const trip = await this.getTripDetail(openid, tripId);
    if (!trip) throw AppError.NOT_FOUND('行程不存在');

    let text = `📍 ${trip.title}\n`;
    text += `📅 ${trip.start_date} · ${trip.days}天\n`;
    text += `🏷 ${trip.preferences.join(' / ')}\n\n`;

    for (const day of trip.itinerary) {
      text += `━━━ DAY ${day.day_number} ━━━\n`;
      for (const item of day.items) {
        if (item.type === 'spot') {
          text += `📍 ${item.name}\n   ${item.address} · ${item.duration}\n`;
          if (item.description) text += `   ${item.description}\n`;
          if (item.transport_to_next) text += `   → ${item.transport_to_next}\n`;
        } else if (item.type === 'food') {
          text += `🍜 ${item.name}\n   ${item.address}\n   ${item.recommend} · ${item.budget}\n`;
        } else if (item.type === 'hotel') {
          text += `🏨 ${item.name}\n   ${item.address}\n   ${item.budget}\n`;
        }
      }
      text += '\n';
    }

    return text;
  }
}

export const tripService = new TripService();
