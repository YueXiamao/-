// 用户行为分析服务
import { getDb } from '../db/database.js';

const VALID_EVENT_TYPES = new Set([
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
]);

export class AnalyticsService {
  /**
   * 记录用户事件（异步，不阻塞主流程）
   * @param {object} params
   * @param {string} params.openid - 用户 openid（可选，匿名用户可为空字符串）
   * @param {string} params.event_type - 事件类型
   * @param {string} [params.target_type] - 目标类型（trip/item/destination）
   * @param {string} [params.target_id] - 目标ID
   * @param {object} [params.payload] - 附加数据
   */
  async track({ openid = '', event_type, target_type = '', target_id = '', payload = {} }) {
    if (!event_type || !VALID_EVENT_TYPES.has(event_type)) {
      return { code: 20001, message: '无效的事件类型' };
    }

    try {
      const db = getDb();
      await db.run(
        `INSERT INTO user_event (openid, event_type, target_type, target_id, payload)
         VALUES (?, ?, ?, ?, ?)`,
        openid, event_type, target_type, target_id,
        typeof payload === 'object' ? JSON.stringify(payload) : String(payload)
      );
      return { code: 0, message: 'success' };
    } catch (err) {
      // 埋点失败不影响主流程，只记录日志
      console.error('[Analytics] track failed:', err.message);
      return { code: 0, message: 'success' }; // 始终返回成功，前端无需感知
    }
  }

  /**
   * 批量记录事件（内部使用）
   */
  async trackBatch(events) {
    const db = getDb();
    const tx = db.transaction((list) => {
      for (const e of list) {
        if (!VALID_EVENT_TYPES.has(e.event_type)) continue;
        db.prepare(
          `INSERT INTO user_event (openid, event_type, target_type, target_id, payload)
           VALUES (?, ?, ?, ?, ?)`
        ).run(
          e.openid || '', e.event_type, e.target_type || '', e.target_id || '',
          typeof e.payload === 'object' ? JSON.stringify(e.payload) : String(e.payload || '{}')
        );
      }
    });
    try {
      tx(events);
      return { code: 0, message: 'success', count: events.length };
    } catch (err) {
      console.error('[Analytics] trackBatch failed:', err.message);
      return { code: 0, message: 'success' };
    }
  }
}

export const analyticsService = new AnalyticsService();
