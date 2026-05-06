// 行为埋点服务
// 特性：静默失败，不阻塞主流程；批量上报减少请求
import { api } from './api.js';

const EVENT_QUEUE_KEY = 'analytics_event_queue';
const MAX_QUEUE_SIZE = 50;
const FLUSH_THRESHOLD = 10;

function createDefaultStorage() {
  return typeof wx !== 'undefined' ? wx : null;
}

export function createAnalyticsService({
  apiClient = api,
  storage = createDefaultStorage(),
  flushThreshold = FLUSH_THRESHOLD,
  maxQueueSize = MAX_QUEUE_SIZE
} = {}) {
  let queue = [];
  let flushPromise = null;

  function loadQueue() {
    try {
      queue = storage?.getStorageSync?.(EVENT_QUEUE_KEY) || [];
    } catch {
      queue = [];
    }
  }

  function saveQueue() {
    try {
      storage?.setStorageSync?.(EVENT_QUEUE_KEY, queue);
    } catch {}
  }

  async function flushAsync() {
    if (flushPromise) return flushPromise;

    flushPromise = (async () => {
      loadQueue();
      if (queue.length === 0) return;

      const events = [...queue];
      queue = [];
      saveQueue();

      try {
        await apiClient.post('/api/analytics/event', { events }, { silent: true });
      } catch (_) {
        queue = [...events.slice(-maxQueueSize), ...queue].slice(-maxQueueSize);
        saveQueue();
      }
    })();

    try {
      await flushPromise;
    } finally {
      flushPromise = null;
    }
  }

  function enqueue(eventType, payload = {}) {
    loadQueue();
    queue.push({ eventType, payload, ts: Date.now() });
    if (queue.length > maxQueueSize) {
      queue = queue.slice(-maxQueueSize);
    }
    saveQueue();
    if (queue.length >= flushThreshold) {
      flushAsync();
    }
  }

  function track(eventType, payload = {}) {
    enqueue(eventType, payload);
  }

  track.flush = flushAsync;

  return { track, flush: flushAsync };
}

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

export const { track } = createAnalyticsService();

track.tripGenerateSuccess = (tripId, city) =>
  track('trip_generate_success', { target_type: 'trip', target_id: tripId, city });

track.tripGenerateFailed = (reason) =>
  track('trip_generate_failed', { target_type: 'trip', reason });

track.tripSave = (tripId) =>
  track('trip_save', { target_type: 'trip', target_id: tripId });

track.tripCopy = (tripId) =>
  track('trip_copy', { target_type: 'trip', target_id: tripId });

track.tripShare = (tripId) =>
  track('trip_share', { target_type: 'trip', target_id: tripId });

track.tripItemReplace = (tripId, itemId, newItemId) =>
  track('trip_item_replace', { target_type: 'trip_item', target_id: itemId, new_item_id: newItemId, trip_id: tripId });

track.tripItemDelete = (tripId, itemId) =>
  track('trip_item_delete', { target_type: 'trip_item', target_id: itemId, trip_id: tripId });

track.discoverRecommendView = (city, province) =>
  track('discover_recommend_view', { target_type: 'recommendation', city, province });

track.discoverDetailOpen = (name, city) =>
  track('discover_detail_open', { target_type: 'recommendation', name, city });

track.feedbackTooRushed = (tripId) =>
  track('feedback_too_rushed', { target_type: 'feedback', trip_id: tripId });

track.feedbackBudgetMismatch = (tripId) =>
  track('feedback_budget_mismatch', { target_type: 'feedback', trip_id: tripId });

track.feedbackNotInterested = (tripId, reason) =>
  track('feedback_not_interested', { target_type: 'feedback', trip_id: tripId, reason });

export default { track, EVENT_TYPES };
