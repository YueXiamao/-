import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCityPickerState,
  buildDiscoverParamsDraft,
  buildDiscoverRecommendRequest,
  buildManualLocationSelection
} from '../pages/discover/input/flow-state.js';
import { buildTripParamsFromRecommendation } from '../pages/discover/result/plan-entry.js';

test('buildCityPickerState enters city step with cleared search state', () => {
  const state = buildCityPickerState({
    code: '510000',
    name: '四川省'
  }, [
    { code: '510100', name: '成都市' },
    { code: '510700', name: '绵阳市' }
  ]);

  assert.equal(state.pickerStep, 'city');
  assert.deepEqual(state.currentProvince, { code: '510000', name: '四川省' });
  assert.deepEqual(state.currentCity, null);
  assert.equal(state.searchValue, '');
  assert.equal(state.filteredList.length, 2);
});

test('buildManualLocationSelection returns stable location text and storage shape', () => {
  const selection = buildManualLocationSelection({
    code: '330000',
    name: '浙江省'
  }, {
    code: '330100',
    name: '杭州市'
  });

  assert.equal(selection.locationMode, 'manual');
  assert.equal(selection.locationText, '浙江省 杭州市');
  assert.deepEqual(selection.currentCity, { code: '330100', name: '杭州市' });
});

test('buildDiscoverParamsDraft normalizes cached recommend params for storage', () => {
  const params = buildDiscoverParamsDraft({
    locationMode: 'manual',
    currentProvince: { code: '440000', name: '广东省' },
    currentCity: { code: '440300', name: '深圳市' },
    days: '3',
    budget: '1000-2000',
    preferences: ['美食', '', '城市漫步', '美食']
  });

  assert.deepEqual(params, {
    location_mode: 'manual',
    province: '广东省',
    city: '深圳市',
    days: 3,
    budget: '1000-2000',
    preferences: ['美食', '城市漫步']
  });
});

test('buildDiscoverRecommendRequest maps cached params to backend payload', () => {
  const payload = buildDiscoverRecommendRequest({
    province: '江苏省',
    city: '苏州市',
    days: 4,
    budget: '500-1000',
    preferences: ['园林', '慢节奏']
  });

  assert.deepEqual(payload, {
    current_location: {
      city: '苏州市',
      province: '江苏省'
    },
    days: 4,
    budget: '500-1000',
    preferences: ['园林', '慢节奏']
  });
});

test('buildTripParamsFromRecommendation keeps discover context when entering plan flow', () => {
  const params = buildTripParamsFromRecommendation({
    destination: {
      name: '杭州',
      city: '杭州市',
      province: '浙江省'
    },
    discoverParams: {
      location_mode: 'loc',
      province: '江苏省',
      city: '苏州市',
      days: 3,
      preferences: ['美食', '休闲']
    },
    now: new Date('2026-05-01T08:00:00.000Z')
  });

  assert.deepEqual(params.destinations, [{
    name: '杭州',
    province: '浙江省',
    city: '杭州市',
    level: 'city'
  }]);
  assert.equal(params.start_date, '2026-05-01');
  assert.equal(params.days, 3);
  assert.deepEqual(params.preferences, ['美食', '休闲']);
  assert.equal(params.entry_source, 'discover');
  assert.deepEqual(params.discover_context, {
    location_mode: 'loc',
    source_province: '江苏省',
    source_city: '苏州市',
    recommendation_name: '杭州',
    recommendation_province: '浙江省',
    recommendation_city: '杭州市'
  });
  assert.equal(params.extra_notes.includes('来自随机玩推荐：杭州'), true);
});

test('buildTripParamsFromRecommendation falls back to recommendation name as city', () => {
  const params = buildTripParamsFromRecommendation({
    destination: { name: '大理' },
    discoverParams: {
      province: '云南省',
      city: '昆明市',
      days: 2,
      preferences: ['自然风光']
    },
    now: new Date('2026-06-18T08:00:00.000Z')
  });

  assert.equal(params.destinations[0].city, '大理');
  assert.equal(params.discover_context.recommendation_city, '大理');
});
