import assert from 'node:assert/strict';
import test from 'node:test';

test('analytics batches events until flush threshold instead of posting each track', async () => {
  const { createAnalyticsService } = await import('../services/analytics.js');
  const stored = {};
  const posts = [];

  const analytics = createAnalyticsService({
    apiClient: {
      async post(path, payload) {
        posts.push({ path, payload });
      }
    },
    storage: {
      getStorageSync(key) {
        return stored[key];
      },
      setStorageSync(key, value) {
        stored[key] = value;
      }
    },
    flushThreshold: 3
  });

  analytics.track('view_home', { source: 'test' });
  analytics.track('tap_plan', { source: 'test' });
  await Promise.resolve();

  assert.equal(posts.length, 0);
  assert.equal(stored.analytics_event_queue.length, 2);

  analytics.track('tap_generate', { source: 'test' });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, '/api/analytics/event');
  assert.deepEqual(posts[0].payload.events.map((item) => item.eventType), [
    'view_home',
    'tap_plan',
    'tap_generate'
  ]);
  assert.deepEqual(stored.analytics_event_queue, []);
});
