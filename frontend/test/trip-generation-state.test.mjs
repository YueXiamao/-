import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGenerationState } from '../pages/plan/result/generation-state.js';

test('normalizeGenerationState returns degraded state for rule_based responses', () => {
  const state = normalizeGenerationState({
    source: 'rule_based',
    fallback_level: 'rule_based',
    generation_meta: { phase: 'degraded', warnings: ['ai_skipped'] }
  });

  assert.equal(state.phase, 'degraded');
  assert.equal(state.fallbackLevel, 'rule_based');
  assert.equal(state.isDegraded, true);
  assert.equal(state.bannerLabel, '可编辑行程');
  assert.equal(state.bannerText.includes('可编辑行程'), true);
});

test('normalizeGenerationState returns degraded template messaging', () => {
  const state = normalizeGenerationState({
    source: 'fallback_template',
    fallback_level: 'template',
    generation_meta: { phase: 'degraded', warnings: ['limited_poi_coverage'] }
  });

  assert.equal(state.phase, 'degraded');
  assert.equal(state.fallbackLevel, 'template');
  assert.equal(state.isDegraded, true);
  assert.equal(state.bannerLabel, '参考行程');
  assert.equal(state.bannerText.includes('数据较少'), true);
});

test('normalizeGenerationState returns ready state for ai_enhanced responses', () => {
  const state = normalizeGenerationState({
    source: 'ai_enhanced',
    fallback_level: 'none',
    generation_meta: { phase: 'ready', warnings: [] }
  });

  assert.equal(state.phase, 'ready');
  assert.equal(state.fallbackLevel, 'none');
  assert.equal(state.isDegraded, false);
  assert.equal(state.bannerLabel, '');
  assert.equal(state.bannerText, '');
});
