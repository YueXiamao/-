// 用户行为分析服务（异步，不阻塞主流程）
import { api } from './api.js';

/**
 * 事件类型常量
 */
export const EVENT_TYPES = {
  TRIP_GENERATE_SUCCESS: 'trip_generate_success',
  TRIP_GENERATE_FAILED: 'trip_generate_failed',
  TRIP_SAVE: 'trip_save',
  TRIP_COPY: 'trip_copy',
  TRIP_SHARE: 'trip_share',
  TRIP_ITEM_REPLACE: 'trip_item_replace',
  TRIP_ITEM_DELETE: 'trip_item_delete',
  DISCOVER_RECOMMEND_VIEW: 'discover_recommend_view',
  DISCOVER_DETAIL_OPEN: 'discover_detail_open',
  FEEDBACK_TOO_RUSHED: 'feedback_too_rushed',
  FEEDBACK_BUDGET_MISMATCH: 'feedback_budget_mismatch',
  FEEDBACK_NOT_INTERESTED: 'feedback_not_interested',
};

/**
 * 静默上报事件（失败不弹窗，不阻塞调用方）
 * @param {string} eventType - 事件类型
 * @param {object} [extra] - { targetType, targetId, payload }
 */
export function track(eventType, extra = {}) {
  api.post('/api/analytics/event', {
    event_type: eventType,
    target_type: extra.targetType || '',
    target_id: extra.targetId || '',
    payload: extra.payload || {},
  }, { silent: true }).catch(() => {
    // 静默忽略任何失败
  });
}

/**
 * 批量上报（不阻塞）
 */
export function trackBatch(events) {
  api.post('/api/analytics/events', { events }, { silent: true }).catch(() => {});
}
