import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPlanParamsDraftState,
  sameDestinationSelection
} from '../pages/plan/params/draft-state.js';
import {
  consumeTripResultEntry,
  createRetryParamsStore
} from '../pages/plan/result/entry-state.js';

test('sameDestinationSelection matches same destinations in same order', () => {
  const left = [
    { name: '北京', level: 'city' },
    { name: '故宫', level: 'district' }
  ];
  const right = [
    { name: '北京', level: 'city' },
    { name: '故宫', level: 'district' }
  ];

  assert.equal(sameDestinationSelection(left, right), true);
});

test('buildPlanParamsDraftState reuses matching draft params', () => {
  const destinations = [{ name: '上海', level: 'city' }];
  const draft = {
    destinations: [{ name: '上海', level: 'city' }],
    start_date: '2026-05-01',
    days: 4,
    preferences: ['文化探索'],
    extra_notes: '少走路'
  };

  const state = buildPlanParamsDraftState({
    destinations,
    draftParams: draft,
    fallbackDate: '2026-04-30'
  });

  assert.equal(state.startDate, '2026-05-01');
  assert.equal(state.days, 4);
  assert.deepEqual(state.preferences, ['文化探索']);
  assert.equal(state.extraNotes, '少走路');
});

test('buildPlanParamsDraftState ignores stale draft from different destinations', () => {
  const state = buildPlanParamsDraftState({
    destinations: [{ name: '杭州', level: 'city' }],
    draftParams: {
      destinations: [{ name: '苏州', level: 'city' }],
      start_date: '2026-05-01',
      days: 5,
      preferences: ['购物休闲'],
      extra_notes: '旧草稿'
    },
    fallbackDate: '2026-04-30'
  });

  assert.equal(state.startDate, '2026-04-30');
  assert.equal(state.days, 2);
  assert.deepEqual(state.preferences, []);
  assert.equal(state.extraNotes, '');
});

test('consumeTripResultEntry prefers trip detail and does not touch cached drafts', () => {
  const removed = [];
  const storage = {
    pre_generated_trip: { trip_id: 'cache-1' },
    trip_params: { days: 2 }
  };

  const entry = consumeTripResultEntry({
    options: { trip_id: '88' },
    getStorageSync: (key) => storage[key],
    removeStorageSync: (key) => removed.push(key)
  });

  assert.deepEqual(entry, { mode: 'detail', tripId: '88' });
  assert.deepEqual(removed, []);
});

test('consumeTripResultEntry consumes cached generated trip before trip params', () => {
  const removed = [];
  const generatedTrip = { trip_id: 'generated-1' };

  const entry = consumeTripResultEntry({
    options: {},
    getStorageSync: (key) => ({
      pre_generated_trip: generatedTrip,
      trip_params: { days: 3 }
    }[key]),
    removeStorageSync: (key) => removed.push(key)
  });

  assert.equal(entry.mode, 'generated');
  assert.equal(entry.trip.trip_id, 'generated-1');
  assert.deepEqual(removed, ['pre_generated_trip']);
});

test('consumeTripResultEntry consumes trip params once for fresh generation', () => {
  const removed = [];
  const params = { destinations: [{ name: '成都' }], days: 3 };

  const entry = consumeTripResultEntry({
    options: {},
    getStorageSync: (key) => ({
      trip_params: params
    }[key]),
    removeStorageSync: (key) => removed.push(key)
  });

  assert.equal(entry.mode, 'generate');
  assert.deepEqual(entry.params, params);
  assert.deepEqual(removed, ['trip_params']);
});

test('createRetryParamsStore keeps params available for retry after storage consumption', () => {
  const store = createRetryParamsStore();
  const params = { days: 2, preferences: ['轻松度假'] };

  store.set(params);

  assert.deepEqual(store.get(), params);

  store.clear();

  assert.equal(store.get(), null);
});
