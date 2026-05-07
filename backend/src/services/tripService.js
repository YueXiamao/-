import { nanoid } from 'nanoid';
import { getDb } from '../db/database.js';
import { poiService } from './poiService.js';
import { userService } from './userService.js';
import { Errors } from '../middleware/errorHandler.js';
import { TripGenerationOrchestrator } from './trip-generation/orchestrator.js';
import { TripCandidateService } from './trip-generation/candidateService.js';
import { TripSkeletonBuilder } from './trip-generation/skeletonBuilder.js';
import { FallbackTemplateProvider } from './trip-generation/fallbackTemplateProvider.js';
import { TripAIEnhancer } from './trip-generation/aiEnhancer.js';
import { TripResultValidator } from './trip-generation/resultValidator.js';

class TripService {
  constructor() {
    this.orchestrator = new TripGenerationOrchestrator({
      tripService: this,
      candidateService: new TripCandidateService({ poiService }),
      skeletonBuilder: new TripSkeletonBuilder(),
      fallbackTemplateProvider: new FallbackTemplateProvider(),
      aiEnhancer: new TripAIEnhancer(),
      resultValidator: new TripResultValidator()
    });
  }

  get db() {
    return getDb();
  }

  async generate(input) {
    return this.orchestrator.generate(input);
  }

  buildGeneratedTripResponse(request, generation) {
    return {
      trip_id: `T${Date.now()}${nanoid(6).toUpperCase()}`,
      title: `${request.destinations.map((item) => typeof item === 'string' ? item : item.name).join('+')}${request.days}\u65e5\u6e38`,
      destinations: request.destinations,
      days: request.days,
      start_date: request.start_date,
      itinerary: generation.itinerary,
      source: generation.source,
      fallback_level: generation.fallback_level,
      generation_meta: generation.generation_meta
    };
  }

  saveTrip(openid, tripData) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) {
      throw Errors.UNAUTHORIZED('用户不存在');
    }

    const insert = this.db.transaction(() => {
      const tripResult = this.db.prepare(`
        INSERT INTO trip (user_id, title, destinations, start_date, days, preferences, extra_notes, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)
      `).run(
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
      const dayStmt = this.db.prepare(
        'INSERT INTO trip_day (trip_id, day_number, date, summary) VALUES (?, ?, ?, ?)'
      );
      const itemStmt = this.db.prepare(`
        INSERT INTO trip_item (trip_day_id, type, name, address, description, duration, budget, recommend, reason, transport_to_next, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const day of tripData.itinerary || []) {
        const dayResult = dayStmt.run(tripId, day.day, day.date, day.summary || '');
        const dayId = dayResult.lastInsertRowid;

        (day.items || []).forEach((item, itemIndex) => {
          itemStmt.run(
            dayId,
            item.type,
            item.name,
            item.address || '',
            item.description || '',
            item.duration || '',
            item.budget || '',
            item.recommend || '',
            item.reason || '',
            item.transport_to_next || '',
            item.notes || '',
            itemIndex
          );
        });
      }

      return tripId;
    });

    const tripId = insert();
    return { trip_id: tripId, title: tripData.title };
  }

  getTripList(openid, { page = 1, page_size = 20, source } = {}) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) {
      return { list: [], total: 0 };
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safePageSize = Math.min(Math.max(parseInt(page_size, 10) || 20, 1), 50);
    const offset = (safePage - 1) * safePageSize;
    const params = [userId];
    let where = '';

    if (source && ['plan', 'discover'].includes(source)) {
      where = 'AND source = ?';
      params.push(source);
    }

    const list = this.db.prepare(`
      SELECT id, title, destinations, start_date, days, preferences, status, source, created_at
      FROM trip
      WHERE user_id = ? ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, safePageSize, offset);

    const { count } = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM trip
      WHERE user_id = ? ${where}
    `).get(...params);

    return {
      list: list.map((item) => ({
        ...item,
        destinations: this.parseJsonArray(item.destinations),
        preferences: this.parseJsonArray(item.preferences)
      })),
      total: count,
      page: safePage,
      page_size: safePageSize
    };
  }

  getTripDetail(openid, tripId) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) return null;

    const trip = this.db.prepare(
      'SELECT * FROM trip WHERE id = ? AND user_id = ?'
    ).get(tripId, userId);

    if (!trip) return null;

    const itinerary = this.db.prepare(
      'SELECT * FROM trip_day WHERE trip_id = ? ORDER BY day_number'
    ).all(tripId).map((day) => ({
      ...day,
      items: this.db.prepare(
        'SELECT * FROM trip_item WHERE trip_day_id = ? ORDER BY sort_order'
      ).all(day.id)
    }));

    return {
      ...trip,
      destinations: this.parseJsonArray(trip.destinations),
      preferences: this.parseJsonArray(trip.preferences),
      itinerary
    };
  }

  deleteTrip(openid, tripId) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) throw Errors.UNAUTHORIZED('用户不存在');

    const result = this.db.prepare(
      'DELETE FROM trip WHERE id = ? AND user_id = ?'
    ).run(tripId, userId);

    if (result.changes === 0) {
      throw Errors.NOT_FOUND('行程不存在');
    }

    return { success: true };
  }

  updateTripItemNote(openid, tripId, itemId, notes) {
    const trip = this.getOwnedTrip(openid, tripId);

    const result = this.db.prepare(`
      UPDATE trip_item
      SET notes = ?
      WHERE id = ?
        AND trip_day_id IN (SELECT id FROM trip_day WHERE trip_id = ?)
    `).run(notes || '', itemId, trip.id);

    if (result.changes === 0) throw Errors.NOT_FOUND('行程项不存在');

    this.touchTrip(trip.id);
    return { success: true };
  }

  reorderTripItem(openid, tripId, itemId, direction) {
    const trip = this.getOwnedTrip(openid, tripId);
    if (!['up', 'down'].includes(direction)) {
      throw Errors.VALIDATION_ERROR('无效的排序方向');
    }

    const currentItem = this.db.prepare(`
      SELECT ti.id, ti.trip_day_id, ti.sort_order
      FROM trip_item ti
      JOIN trip_day td ON td.id = ti.trip_day_id
      WHERE ti.id = ? AND td.trip_id = ?
    `).get(itemId, trip.id);

    if (!currentItem) throw Errors.NOT_FOUND('行程项不存在');

    const adjacentItem = direction === 'up'
      ? this.db.prepare(`
          SELECT id, sort_order
          FROM trip_item
          WHERE trip_day_id = ? AND sort_order < ?
          ORDER BY sort_order DESC
          LIMIT 1
        `).get(currentItem.trip_day_id, currentItem.sort_order)
      : this.db.prepare(`
          SELECT id, sort_order
          FROM trip_item
          WHERE trip_day_id = ? AND sort_order > ?
          ORDER BY sort_order ASC
          LIMIT 1
        `).get(currentItem.trip_day_id, currentItem.sort_order);

    if (!adjacentItem) {
      return { success: true, moved: false };
    }

    this.db.transaction(() => {
      this.db.prepare('UPDATE trip_item SET sort_order = ? WHERE id = ?')
        .run(adjacentItem.sort_order, currentItem.id);
      this.db.prepare('UPDATE trip_item SET sort_order = ? WHERE id = ?')
        .run(currentItem.sort_order, adjacentItem.id);
      this.touchTrip(trip.id);
    })();

    return { success: true, moved: true, direction };
  }

  async replaceTripItem(openid, tripId, itemId, { intent } = {}) {
    const trip = this.getOwnedTrip(openid, tripId);

    const currentItem = this.db.prepare(`
      SELECT ti.*, td.day_number
      FROM trip_item ti
      JOIN trip_day td ON td.id = ti.trip_day_id
      WHERE ti.id = ? AND td.trip_id = ?
    `).get(itemId, trip.id);

    if (!currentItem) throw Errors.NOT_FOUND('行程项不存在');

    const destinations = this.parseJsonArray(trip.destinations);
    const primaryDestination = destinations[0] || {};
    const searchCity = primaryDestination.city || primaryDestination.name || '';
    const searchKeyword = primaryDestination.name || currentItem.name;

    const intentFilterMap = {
      nearer: ['近', '方便', '市中心'],
      cheaper: ['便宜', '实惠', '经济'],
      indoor: ['室', '馆', '内', '博物馆', '展览'],
      family: ['亲子', '儿童', '家庭', '适合小朋友']
    };

    const intentKeywords = intent && intent !== 'any' ? (intentFilterMap[intent] || []) : [];

    const localCandidates = searchCity
      ? this.normalizeReplacementCandidates(this.db.prepare(`
          SELECT name, address, type, city, price, tags
          FROM poi
          WHERE city = ? AND type = ?
          ORDER BY id DESC
          LIMIT 20
        `).all(searchCity, currentItem.type))
      : [];

    const remoteCandidates = this.normalizeReplacementCandidates(
      await poiService.search({
        keyword: searchKeyword,
        type: currentItem.type,
        city: searchCity,
        limit: 10
      })
    );

    const allCandidates = [...localCandidates, ...remoteCandidates].filter((c) => c.name && c.name !== currentItem.name);

    let replacement;
    if (intentKeywords.length > 0) {
      replacement = allCandidates.find((c) => {
        const text = `${c.name}${c.address}${c.tags?.join?.('') || ''}`.toLowerCase();
        return intentKeywords.some((kw) => text.includes(kw.toLowerCase()));
      }) || allCandidates[0];
    } else {
      replacement = allCandidates[0];
    }

    if (!replacement) {
      throw Errors.NOT_FOUND('暂未找到可替换的候选项');
    }

    const nextItem = this.buildReplacementItem(currentItem, replacement);
    this.db.prepare(`
      UPDATE trip_item
      SET name = ?, address = ?, description = ?, duration = ?, budget = ?,
          recommend = ?, reason = ?, transport_to_next = ?
      WHERE id = ?
    `).run(
      nextItem.name,
      nextItem.address,
      nextItem.description,
      nextItem.duration,
      nextItem.budget,
      nextItem.recommend,
      nextItem.reason,
      nextItem.transport_to_next,
      itemId
    );

    this.touchTrip(trip.id);
    return {
      success: true,
      item: this.db.prepare('SELECT * FROM trip_item WHERE id = ?').get(itemId)
    };
  }

  deleteTripItem(openid, tripId, itemId) {
    const trip = this.getOwnedTrip(openid, tripId);

    const result = this.db.prepare(`
      DELETE FROM trip_item
      WHERE id = ?
        AND trip_day_id IN (SELECT id FROM trip_day WHERE trip_id = ?)
    `).run(itemId, trip.id);

    if (result.changes === 0) throw Errors.NOT_FOUND('行程项不存在');

    this.touchTrip(trip.id);
    return { success: true };
  }

  exportTrip(openid, tripId) {
    const trip = this.getTripDetail(openid, tripId);
    if (!trip) throw Errors.NOT_FOUND('行程不存在');

    const lines = [
      trip.title,
      `${trip.start_date} · ${trip.days}天`,
      (trip.preferences || []).join(' / '),
      ''
    ];

    for (const day of trip.itinerary || []) {
      lines.push(`DAY ${day.day_number || day.day} ${day.date}`);
      for (const item of day.items || []) {
        lines.push(`${item.name}${item.duration ? ` · ${item.duration}` : ''}`);
        if (item.address) lines.push(`地址：${item.address}`);
        if (item.description) lines.push(item.description);
        if (item.recommend) lines.push(`推荐：${item.recommend}`);
        if (item.budget) lines.push(`预算：${item.budget}`);
        if (item.transport_to_next) lines.push(`交通：${item.transport_to_next}`);
        if (item.notes) lines.push(`备注：${item.notes}`);
        lines.push('');
      }
    }

    return { text: lines.join('\n').trim() };
  }

  getOwnedTrip(openid, tripId) {
    const userId = userService.getUserIdByOpenid(openid);
    if (!userId) throw Errors.UNAUTHORIZED('用户不存在');

    const trip = this.db.prepare(
      'SELECT id, destinations FROM trip WHERE id = ? AND user_id = ?'
    ).get(tripId, userId);

    if (!trip) throw Errors.NOT_FOUND('行程不存在');
    return trip;
  }

  touchTrip(tripId) {
    this.db.prepare('UPDATE trip SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(tripId);
  }

  recordFeedback(openid, tripId, type) {
    if (!openid || !tripId) return { success: false };
    try {
      this.db.prepare(`
        INSERT INTO feedback (trip_id, openid, feedback_type, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(tripId, openid, type || 'unknown');
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  normalizeReplacementCandidates(items = []) {
    return items.map((item) => ({
      name: item.name || '',
      address: item.address || '',
      city: item.city || '',
      type: item.type || '',
      description: item.description || '',
      recommend: item.recommend || this.buildRecommendText(item),
      budget: item.budget || this.buildBudgetText(item),
      reason: item.reason || ''
    }));
  }

  buildRecommendText(item) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return tags.length > 0 ? tags.slice(0, 3).join(' / ') : '';
  }

  buildBudgetText(item) {
    if (item?.price === null || item?.price === undefined || item?.price === '') {
      return item?.budget || '';
    }

    const amount = Number(item.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return item?.budget || '';
    }

    if (item.type === 'food') return `人均${amount.toFixed(0)}元`;
    if (item.type === 'hotel') return `约${amount.toFixed(0)}元起`;
    return item?.budget || '';
  }

  buildReplacementItem(currentItem, replacement) {
    const nextItem = {
      ...currentItem,
      name: replacement.name,
      address: replacement.address || currentItem.address || ''
    };

    if (currentItem.type === 'spot') {
      nextItem.description = replacement.description || `${replacement.name}更适合接入当天行程。`;
      nextItem.duration = currentItem.duration || '2-3小时';
    }

    if (currentItem.type === 'food') {
      nextItem.recommend = replacement.recommend || currentItem.recommend || '本地口碑餐厅';
      nextItem.budget = replacement.budget || currentItem.budget || '';
    }

    if (currentItem.type === 'hotel') {
      nextItem.reason = replacement.reason || currentItem.reason || '替换为同区域的住宿选项';
      nextItem.budget = replacement.budget || currentItem.budget || '';
    }

    return nextItem;
  }
}

export const tripService = new TripService();
