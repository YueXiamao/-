// 用户行为分析服务
import { getDb } from '../db/database.js';

// 允许的事件类型白名单
const ALLOWED_EVENTS = [
  'trip_generate_success',
  'trip_generate_failed',
  'trip_save',
  'trip_copy',
  'trip_share',
  'trip_item_replace',
  'trip_item_delete',
  'discover_recommend_view',
  'discover_detail_open',
  'feedback_too_rushed',
  'feedback_budget_mismatch',
  'feedback_not_interested',
];

class AnalyticsService {
  get db() {
    return getDb();
  }

  /**
   * 记录单个事件
   * @param {string} eventType - 事件类型
   * @param {object} [payload={}] - 附加数据
   * @param {string} [openid] - 用户 openid（可选，未登录时为空）
   */
  track(eventType, payload = {}, openid = '') {
    if (!ALLOWED_EVENTS.includes(eventType)) {
      console.warn(`[Analytics] 未知事件类型: ${eventType}`);
      return;
    }
    try {
      this.db.prepare(`
        INSERT INTO user_event (openid, event_type, target_type, target_id, payload)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        openid || '',
        eventType,
        payload.target_type || '',
        payload.target_id || '',
        JSON.stringify(payload)
      );
    } catch (err) {
      // 埋点失败不影响主流程，只记录日志
      console.error('[Analytics] 记录事件失败:', err.message);
    }
  }

  /**
   * 批量记录事件（事务保证原子性）
   */
  trackBatch(events, openid = '') {
    if (!Array.isArray(events) || events.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT INTO user_event (openid, event_type, target_type, target_id, payload)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.db.transaction(() => {
      for (const { eventType, payload = {} } of events) {
        if (!ALLOWED_EVENTS.includes(eventType)) continue;
        stmt.run(openid || '', eventType, payload.target_type || '', payload.target_id || '', JSON.stringify(payload));
      }
    })();
  }

  /**
   * 获取用户在某时间段内的事件统计
   */
  getStats(openid, since) {
    return this.db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM user_event
      WHERE openid = ? AND created_at >= ?
      GROUP BY event_type
    `).all(openid, since);
  }
}

export const analyticsService = new AnalyticsService();
