// 行程服务
import { nanoid } from 'nanoid';
import { getDb } from '../db/database.js';
import { poiService } from './poiService.js';
import { userService } from './userService.js';
import { AppError } from '../middleware/errorHandler.js';

class TripService {
  get db() {
    return getDb();
  }

  // 生成行程
  async generate({ destinations, start_date, days, preferences, extra_notes }) {
    // 收集各目的地的 POI
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

    // 延迟导入，避免循环
    const { aiGenerator } = await import('../ai/generator.js');

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
      console.error('AI 生成失败:', err.message);
      itinerary = this.getFallbackTemplate(destinations, days, start_date);
    }

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

  // 兜底模板
  getFallbackTemplate(destinations, days, startDate) {
    const result = [];
    const destNames = destinations.map(d => typeof d === 'string' ? d : d.name);
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);

      result.push({
        day: i + 1,
        date: d.toISOString().split('T')[0],
        items: [
          {
            type: 'spot',
            name: `${destNames[i % destNames.length]}景区${i + 1}`,
            address: '待填充',
            duration: '2-3小时',
            description: '请稍后重试获取AI推荐',
            transport_to_next: ''
          },
          {
            type: 'food',
            name: `${destNames[i % destNames.length]}特色美食`,
            address: '待填充',
            budget: '人均50-100元',
            recommend: '当地特色菜品'
          },
          {
            type: 'hotel',
            name: `${destNames[i % destNames.length]}住宿`,
            address: '待填充',
            budget: '待确认',
            reason: '请在结果页查看详细'
          }
        ]
      });
    }

    return result;
  }

  // 保存行程
  saveTrip(openid, tripData) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) {
      throw AppError.UNAUTHORIZED('用户不存在');
    }

    const insert = this.db.transaction(() => {
      const tripStmt = this.db.prepare(`
        INSERT INTO trip (user_id, title, destinations, start_date, days, preferences, extra_notes, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)
      `);
      const tripResult = tripStmt.run(
        userId,
        tripData.title,
        JSON.stringify(tripData.destinations),
        tripData.start_date,
        tripData.days,
        JSON.stringify(tripData.preferences || []),
        tripData.extra_notes || '',
        tripData.source || 'plan'
      );
      const tripId = tripResult.lastInsertRowid;

      for (const dayData of tripData.itinerary) {
        const dayStmt = this.db.prepare(
          'INSERT INTO trip_day (trip_id, day_number, date, summary) VALUES (?, ?, ?, ?)'
        );
        const dayResult = dayStmt.run(tripId, dayData.day, dayData.date, dayData.summary || '');
        const dayId = dayResult.lastInsertRowid;

        const itemStmt = this.db.prepare(`
          INSERT INTO trip_item (trip_day_id, type, name, address, description, duration, budget, recommend, reason, transport_to_next, notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        dayData.items.forEach((item, idx) => {
          itemStmt.run(
            dayId, item.type, item.name, item.address || '', item.description || '',
            item.duration || '', item.budget || '', item.recommend || '',
            item.reason || '', item.transport_to_next || '', item.notes || '', idx
          );
        });
      }

      return tripId;
    });

    const tripId = insert();
    return { trip_id: tripId, title: tripData.title };
  }

  // 行程列表
  getTripList(openid, { page = 1, page_size = 20, source } = {}) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) return { list: [], total: 0 };

    const offset = (page - 1) * page_size;
    const where = source ? `AND source = '${source}'` : '';

    const list = this.db.prepare(
      `SELECT id, title, destinations, start_date, days, preferences, status, source, created_at
       FROM trip WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(userId, page_size, offset);

    const { count } = this.db.prepare(
      `SELECT COUNT(*) as count FROM trip WHERE user_id = ? ${where}`
    ).get(userId);

    return {
      list: list.map(r => ({
        ...r,
        destinations: JSON.parse(r.destinations),
        preferences: JSON.parse(r.preferences)
      })),
      total: count,
      page,
      page_size
    };
  }

  // 行程详情
  getTripDetail(openid, tripId) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) return null;

    const trip = this.db.prepare(
      'SELECT * FROM trip WHERE id = ? AND user_id = ?'
    ).get(tripId, userId);

    if (!trip) return null;

    const days = this.db.prepare(
      'SELECT * FROM trip_day WHERE trip_id = ? ORDER BY day_number'
    ).all(tripId);

    for (const day of days) {
      day.items = this.db.prepare(
        'SELECT * FROM trip_item WHERE trip_day_id = ? ORDER BY sort_order'
      ).all(day.id);
    }

    return {
      ...trip,
      destinations: JSON.parse(trip.destinations),
      preferences: JSON.parse(trip.preferences),
      itinerary: days
    };
  }

  // 删除行程
  deleteTrip(openid, tripId) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) throw AppError.UNAUTHORIZED('用户不存在');

    const result = this.db.prepare(
      'DELETE FROM trip WHERE id = ? AND user_id = ?'
    ).run(tripId, userId);

    if (result.changes === 0) {
      throw AppError.NOT_FOUND('行程不存在');
    }
    return { success: true };
  }

  // 更新行程单项备注
  updateTripItemNote(openid, tripId, itemId, notes) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) throw AppError.UNAUTHORIZED('用户不存在');

    // 验证权限
    const trip = this.db.prepare(
      'SELECT id FROM trip WHERE id = ? AND user_id = ?'
    ).get(tripId, userId);

    if (!trip) throw AppError.NOT_FOUND('行程不存在');

    this.db.prepare(
      'UPDATE trip_item SET notes = ? WHERE id = ?'
    ).run(notes, itemId);

    return { success: true };
  }
}

export const tripService = new TripService();
