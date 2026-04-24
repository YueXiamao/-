# Trip Generation Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the trip-generation flow so it reliably returns a usable itinerary, classifies degraded results explicitly, and exposes stable frontend states instead of generic success or failure.

**Architecture:** Keep the existing `/api/trip/generate` entry point and the current mini-program page flow, but move generation into a staged backend orchestrator. The orchestrator normalizes input, prepares POI candidates, builds a rule-based skeleton, optionally enhances it with AI, validates the result, and falls back to a template provider before returning a final product-state payload. The frontend result page consumes the new response metadata and renders phase-aware loading, degraded banners, and retry behavior.

**Tech Stack:** Fastify 5, Node 20 ESM, better-sqlite3, WeChat Mini Program JS/WXML/WXSS, Node 20 test runner.

---

## File Structure

### Backend

- Create: `backend/src/services/trip-generation/requestNormalizer.js`
- Create: `backend/src/services/trip-generation/candidateService.js`
- Create: `backend/src/services/trip-generation/skeletonBuilder.js`
- Create: `backend/src/services/trip-generation/aiEnhancer.js`
- Create: `backend/src/services/trip-generation/resultValidator.js`
- Create: `backend/src/services/trip-generation/fallbackTemplateProvider.js`
- Create: `backend/src/services/trip-generation/orchestrator.js`
- Modify: `backend/src/services/tripService.js`
- Modify: `backend/src/routes/trip.js`
- Modify: `backend/src/ai/generator.js`
- Modify: `backend/src/services/poiService.js`
- Modify: `backend/src/middleware/errorHandler.js`
- Modify: `backend/test/backend-contract.test.js`

### Frontend

- Create: `frontend/pages/plan/result/generation-state.js`
- Create: `frontend/test/trip-generation-state.test.mjs`
- Modify: `frontend/services/trip.js`
- Modify: `frontend/services/api.js`
- Modify: `frontend/pages/plan/result/result.js`
- Modify: `frontend/pages/plan/result/result.wxml`
- Modify: `frontend/pages/plan/result/result.wxss`

### Documentation

- Modify: `docs/superpowers/specs/2026-04-24-trip-generation-stability-design.md`

---

### Task 1: Lock the New Response Contract with Backend Tests

**Files:**
- Modify: `backend/test/backend-contract.test.js`

- [ ] **Step 1: Write the failing contract tests for generation source, fallback level, and metadata**

Add three new test cases to `backend/test/backend-contract.test.js`:

```js
test('trip generation returns ai_enhanced metadata when enhanced result passes validation', async () => {
  const { server } = await buildServer();
  const tripServiceModule = await import('../src/services/tripService.js');
  const originalGenerate = tripServiceModule.tripService.generate;

  tripServiceModule.tripService.generate = async () => ({
    trip_id: 'T-DEMO',
    title: 'Chengdu 2-day Trip',
    source: 'ai_enhanced',
    fallback_level: 'none',
    generation_meta: {
      phase: 'ready',
      used_ai: true,
      used_rule_fallback: false,
      used_template_fallback: false,
      warnings: []
    },
    destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
    start_date: '2026-05-01',
    days: 2,
    itinerary: [{ day: 1, date: '2026-05-01', items: [{ type: 'spot', name: 'People Park' }] }]
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'ai_enhanced');
    assert.equal(res.json().fallback_level, 'none');
    assert.equal(res.json().generation_meta.phase, 'ready');
  } finally {
    tripServiceModule.tripService.generate = originalGenerate;
    await server.close();
  }
});

test('trip generation returns rule_based fallback metadata when ai enhancement is skipped or rejected', async () => {
  const { server } = await buildServer();
  const tripServiceModule = await import('../src/services/tripService.js');
  const originalGenerate = tripServiceModule.tripService.generate;

  tripServiceModule.tripService.generate = async () => ({
    trip_id: 'T-RULE',
    title: 'Fallback Trip',
    source: 'rule_based',
    fallback_level: 'rule_based',
    generation_meta: {
      phase: 'degraded',
      used_ai: false,
      used_rule_fallback: true,
      used_template_fallback: false,
      warnings: ['ai_enhancement_failed']
    },
    destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
    start_date: '2026-05-01',
    days: 2,
    itinerary: [{ day: 1, date: '2026-05-01', items: [{ type: 'spot', name: 'Rule Spot' }] }]
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.deepEqual(res.json().generation_meta.warnings, ['ai_enhancement_failed']);
  } finally {
    tripServiceModule.tripService.generate = originalGenerate;
    await server.close();
  }
});

test('trip generation returns a retryable product error when every fallback fails', async () => {
  const { server } = await buildServer();
  const tripServiceModule = await import('../src/services/tripService.js');
  const originalGenerate = tripServiceModule.tripService.generate;

  tripServiceModule.tripService.generate = async () => {
    const error = new Error('trip_generation_failed');
    error.statusCode = 503;
    error.code = 30001;
    error.retryable = true;
    throw error;
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().retryable, true);
    assert.equal(res.json().message, 'trip_generation_failed');
  } finally {
    tripServiceModule.tripService.generate = originalGenerate;
    await server.close();
  }
});
```

- [ ] **Step 2: Run the backend contract tests to verify the new cases fail**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js
```

Expected:

```text
not ok - trip generation returns ai_enhanced metadata when enhanced result passes validation
not ok - trip generation returns rule_based fallback metadata when ai enhancement is skipped or rejected
not ok - trip generation returns a retryable product error when every fallback fails
```

- [ ] **Step 3: Add a small assertion helper for generation metadata shape**

Add near the top of `backend/test/backend-contract.test.js`:

```js
function assertGenerationMetaShape(payload) {
  assert.equal(typeof payload.source, 'string');
  assert.equal(typeof payload.fallback_level, 'string');
  assert.equal(typeof payload.generation_meta, 'object');
  assert.equal(Array.isArray(payload.generation_meta.warnings), true);
}
```

Then call it inside the new successful tests:

```js
assertGenerationMetaShape(res.json());
```

- [ ] **Step 4: Re-run the failing tests and confirm the failure is still on implementation, not on the test shape**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js
```

Expected:

```text
3 failing subtests remain, all related to missing implementation behavior rather than test syntax
```

- [ ] **Step 5: Commit the test-only change**

```bash
git add backend/test/backend-contract.test.js
git commit -m "test: define trip generation stability contract"
```

---

### Task 2: Build the Backend Generation Orchestrator and Product-State Result Shape

**Files:**
- Create: `backend/src/services/trip-generation/requestNormalizer.js`
- Create: `backend/src/services/trip-generation/orchestrator.js`
- Modify: `backend/src/services/tripService.js`
- Modify: `backend/src/routes/trip.js`
- Modify: `backend/src/middleware/errorHandler.js`

- [ ] **Step 1: Write the failing implementation smoke test inside the contract suite**

Add a single contract test that uses the real route and checks `phase` and `fallback_level` on a normal generated response:

```js
test('real trip generation response includes generation_meta and fallback_level', async () => {
  const { server } = await buildServer();
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {
      destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
      start_date: '2026-05-01',
      days: 2,
      preferences: ['Relax']
    }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.json().fallback_level, 'string');
  assert.equal(typeof res.json().generation_meta.phase, 'string');
  await server.close();
});
```

- [ ] **Step 2: Run the single test to verify the current real implementation fails**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js --test-name-pattern "real trip generation response includes generation_meta"
```

Expected:

```text
FAIL because fallback_level or generation_meta.phase is undefined
```

- [ ] **Step 3: Create the request normalizer**

Create `backend/src/services/trip-generation/requestNormalizer.js`:

```js
import { Errors } from '../../middleware/errorHandler.js';

export function normalizeGenerateTripRequest(input = {}) {
  const destinations = Array.isArray(input.destinations) ? input.destinations : [];
  const startDate = input.start_date || '';
  const days = Number(input.days || 0);
  const preferences = Array.isArray(input.preferences) ? input.preferences.filter(Boolean) : [];
  const extraNotes = typeof input.extra_notes === 'string' ? input.extra_notes.trim() : '';

  if (destinations.length === 0 || !startDate || !days || preferences.length === 0) {
    throw Errors.VALIDATION_ERROR('缺少必填参数');
  }

  return {
    destinations: destinations.map((item) => ({
      name: item.name || '',
      province: item.province || '',
      city: item.city || item.name || '',
      district: item.district || ''
    })),
    start_date: startDate,
    days,
    preferences,
    extra_notes: extraNotes
  };
}
```

- [ ] **Step 4: Create the orchestrator skeleton**

Create `backend/src/services/trip-generation/orchestrator.js`:

```js
import { normalizeGenerateTripRequest } from './requestNormalizer.js';

function createGenerationMeta(overrides = {}) {
  return {
    phase: 'ready',
    used_ai: false,
    used_rule_fallback: false,
    used_template_fallback: false,
    warnings: [],
    ...overrides
  };
}

export class TripGenerationOrchestrator {
  constructor({ tripService, candidateService, skeletonBuilder, aiEnhancer, resultValidator, fallbackTemplateProvider }) {
    this.tripService = tripService;
    this.candidateService = candidateService;
    this.skeletonBuilder = skeletonBuilder;
    this.aiEnhancer = aiEnhancer;
    this.resultValidator = resultValidator;
    this.fallbackTemplateProvider = fallbackTemplateProvider;
  }

  async generate(input) {
    const request = normalizeGenerateTripRequest(input);
    const candidates = await this.candidateService.prepare(request);
    const skeleton = await this.skeletonBuilder.build(request, candidates);
    return {
      trip_id: skeleton.trip_id,
      title: skeleton.title,
      source: 'rule_based',
      fallback_level: 'rule_based',
      generation_meta: createGenerationMeta({
        phase: 'degraded',
        used_rule_fallback: true
      }),
      destinations: request.destinations,
      start_date: request.start_date,
      days: request.days,
      itinerary: skeleton.itinerary
    };
  }
}
```

- [ ] **Step 5: Wire `tripService.generate` through the orchestrator**

Replace the current direct generate flow in `backend/src/services/tripService.js` with a delegating shape:

```js
import { TripGenerationOrchestrator } from './trip-generation/orchestrator.js';
import { TripCandidateService } from './trip-generation/candidateService.js';
import { TripSkeletonBuilder } from './trip-generation/skeletonBuilder.js';
import { TripAIEnhancer } from './trip-generation/aiEnhancer.js';
import { TripResultValidator } from './trip-generation/resultValidator.js';
import { FallbackTemplateProvider } from './trip-generation/fallbackTemplateProvider.js';

class TripService {
  constructor() {
    this.generationOrchestrator = new TripGenerationOrchestrator({
      tripService: this,
      candidateService: new TripCandidateService(),
      skeletonBuilder: new TripSkeletonBuilder(),
      aiEnhancer: new TripAIEnhancer(),
      resultValidator: new TripResultValidator(),
      fallbackTemplateProvider: new FallbackTemplateProvider()
    });
  }

  async generate(input) {
    return this.generationOrchestrator.generate(input);
  }
}
```

- [ ] **Step 6: Preserve route validation but stop duplicating deep business logic**

Update `backend/src/routes/trip.js`:

```js
fastify.post('/generate', async (req) => {
  return tripService.generate(req.body || {});
});
```

Leave deeper validation in `normalizeGenerateTripRequest`.

- [ ] **Step 7: Extend the shared error body with `retryable`**

Update `backend/src/middleware/errorHandler.js`:

```js
const response = {
  code: error.code || statusCode,
  message: error.message || '服务器内部错误',
  errors: error.validationErrors || [],
  retryable: error.retryable === true
};
```

- [ ] **Step 8: Run the full backend contract suite**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js
```

Expected:

```text
all existing tests still pass except cases that depend on missing candidate, skeleton, validator, and fallback modules
```

- [ ] **Step 9: Commit the orchestrator wiring**

```bash
git add backend/src/services/trip-generation/requestNormalizer.js backend/src/services/trip-generation/orchestrator.js backend/src/services/tripService.js backend/src/routes/trip.js backend/src/middleware/errorHandler.js backend/test/backend-contract.test.js
git commit -m "feat: add trip generation orchestrator scaffold"
```

---

### Task 3: Implement Candidate Preparation, Rule-Based Skeletons, and Template Fallback

**Files:**
- Create: `backend/src/services/trip-generation/candidateService.js`
- Create: `backend/src/services/trip-generation/skeletonBuilder.js`
- Create: `backend/src/services/trip-generation/fallbackTemplateProvider.js`
- Modify: `backend/src/services/poiService.js`
- Modify: `backend/test/backend-contract.test.js`

- [ ] **Step 1: Write the failing tests for rule-based and template fallback paths**

Add two tests to `backend/test/backend-contract.test.js`:

```js
test('candidate shortage still returns a non-empty rule_based itinerary', async () => {
  const { server } = await buildServer();
  const poiModule = await import('../src/services/poiService.js');
  const originalSearch = poiModule.poiService.search;
  poiModule.poiService.search = async () => [];

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Aba', province: 'Sichuan', city: 'Aba' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().itinerary.length, 2);
    assert.equal(res.json().itinerary.every((day) => day.items.length > 0), true);
  } finally {
    poiModule.poiService.search = originalSearch;
    await server.close();
  }
});

test('template fallback is returned when skeleton building throws', async () => {
  const { server } = await buildServer();
  const tripServiceModule = await import('../src/services/tripService.js');
  const originalBuilder = tripServiceModule.tripService.generationOrchestrator.skeletonBuilder;

  tripServiceModule.tripService.generationOrchestrator.skeletonBuilder = {
    async build() {
      throw new Error('skeleton_failed');
    }
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'fallback_template');
    assert.equal(res.json().fallback_level, 'template');
  } finally {
    tripServiceModule.tripService.generationOrchestrator.skeletonBuilder = originalBuilder;
    await server.close();
  }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js --test-name-pattern "candidate shortage|template fallback"
```

Expected:

```text
FAIL because the real generator still lacks candidate preparation and template fallback logic
```

- [ ] **Step 3: Implement candidate preparation**

Create `backend/src/services/trip-generation/candidateService.js`:

```js
import { poiService } from '../poiService.js';

function dedupeByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.name}:${item.address || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(item.name);
  });
}

export class TripCandidateService {
  async prepare(request) {
    const destination = request.destinations[0];
    const city = destination.city || destination.name;
    const [spots, foods, hotels] = await Promise.all([
      poiService.search({ keyword: city, type: 'spot', city, limit: Math.max(request.days * 4, 8) }),
      poiService.search({ keyword: city, type: 'food', city, limit: Math.max(request.days * 3, 6) }),
      poiService.search({ keyword: city, type: 'hotel', city, limit: Math.max(request.days * 2, 4) })
    ]);

    const result = {
      spots: dedupeByName(spots || []),
      foods: dedupeByName(foods || []),
      hotels: dedupeByName(hotels || []),
      coverage: {
        spot_count: (spots || []).length,
        food_count: (foods || []).length,
        hotel_count: (hotels || []).length
      }
    };

    result.coverage.level = result.coverage.spot_count >= request.days * 2 ? 'strong' : 'weak';
    return result;
  }
}
```

- [ ] **Step 4: Implement the rule-based skeleton builder**

Create `backend/src/services/trip-generation/skeletonBuilder.js`:

```js
import { nanoid } from 'nanoid';

function buildDate(startDate, offset) {
  const value = new Date(startDate);
  value.setDate(value.getDate() + offset);
  return value.toISOString().split('T')[0];
}

export class TripSkeletonBuilder {
  async build(request, candidates) {
    const itinerary = Array.from({ length: request.days }, (_, index) => {
      const spot = candidates.spots[index % Math.max(candidates.spots.length, 1)];
      const food = candidates.foods[index % Math.max(candidates.foods.length, 1)];
      const hotel = candidates.hotels[index % Math.max(candidates.hotels.length, 1)];

      const items = [];
      if (spot) {
        items.push({
          type: 'spot',
          name: spot.name,
          address: spot.address || '',
          duration: '2-3小时',
          description: '',
          transport_to_next: ''
        });
      }
      if (food) {
        items.push({
          type: 'food',
          name: food.name,
          address: food.address || '',
          budget: '',
          recommend: ''
        });
      }
      if (hotel) {
        items.push({
          type: 'hotel',
          name: hotel.name,
          address: hotel.address || '',
          budget: '',
          reason: ''
        });
      }

      if (items.length === 0) {
        throw new Error('empty_skeleton_day');
      }

      return {
        day: index + 1,
        date: buildDate(request.start_date, index),
        items
      };
    });

    return {
      trip_id: `T${Date.now()}${nanoid(6).toUpperCase()}`,
      title: `${request.destinations.map((item) => item.name).join('+')}${request.days}日游`,
      itinerary
    };
  }
}
```

- [ ] **Step 5: Implement the fallback template provider**

Create `backend/src/services/trip-generation/fallbackTemplateProvider.js`:

```js
function buildFallbackDate(startDate, offset) {
  const value = new Date(startDate);
  value.setDate(value.getDate() + offset);
  return value.toISOString().split('T')[0];
}

export class FallbackTemplateProvider {
  build(request) {
    const name = request.destinations[0]?.name || '目的地';
    return {
      source: 'fallback_template',
      fallback_level: 'template',
      itinerary: Array.from({ length: request.days }, (_, index) => ({
        day: index + 1,
        date: buildFallbackDate(request.start_date, index),
        items: [
          { type: 'spot', name: `${name}精选行程点`, address: `${name}市区`, duration: '2小时', description: '基础参考版，可继续替换和调整。', transport_to_next: '' },
          { type: 'food', name: `${name}本地餐饮建议`, address: `${name}市区`, budget: '人均80元', recommend: '本地特色菜' },
          { type: 'hotel', name: `${name}住宿建议`, address: `${name}市区`, budget: '参考300-500元', reason: '优先保证有一版可编辑行程。' }
        ]
      }))
    };
  }
}
```

- [ ] **Step 6: Update the orchestrator to prefer skeletons and then template fallback**

Update `backend/src/services/trip-generation/orchestrator.js`:

```js
async generate(input) {
  const request = normalizeGenerateTripRequest(input);
  const candidates = await this.candidateService.prepare(request);

  try {
    const skeleton = await this.skeletonBuilder.build(request, candidates);
    return {
      trip_id: skeleton.trip_id,
      title: skeleton.title,
      source: 'rule_based',
      fallback_level: 'rule_based',
      generation_meta: createGenerationMeta({
        phase: 'degraded',
        used_rule_fallback: true,
        warnings: candidates.coverage.level === 'weak' ? ['candidate_coverage_low'] : []
      }),
      destinations: request.destinations,
      start_date: request.start_date,
      days: request.days,
      itinerary: skeleton.itinerary
    };
  } catch (error) {
    const template = this.fallbackTemplateProvider.build(request);
    return {
      trip_id: `T${Date.now()}TEMP`,
      title: `${request.destinations.map((item) => item.name).join('+')}${request.days}日游`,
      source: template.source,
      fallback_level: template.fallback_level,
      generation_meta: createGenerationMeta({
        phase: 'degraded',
        used_template_fallback: true,
        warnings: ['skeleton_failed']
      }),
      destinations: request.destinations,
      start_date: request.start_date,
      days: request.days,
      itinerary: template.itinerary
    };
  }
}
```

- [ ] **Step 7: Run the backend contract suite**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js
```

Expected:

```text
the new fallback-path tests pass, while AI-enhanced tests still fail
```

- [ ] **Step 8: Commit the rule-based fallback layer**

```bash
git add backend/src/services/trip-generation/candidateService.js backend/src/services/trip-generation/skeletonBuilder.js backend/src/services/trip-generation/fallbackTemplateProvider.js backend/src/services/trip-generation/orchestrator.js backend/test/backend-contract.test.js
git commit -m "feat: add rule-based trip skeleton and template fallback"
```

---

### Task 4: Add AI Enhancement and Result Validation

**Files:**
- Create: `backend/src/services/trip-generation/aiEnhancer.js`
- Create: `backend/src/services/trip-generation/resultValidator.js`
- Modify: `backend/src/ai/generator.js`
- Modify: `backend/src/services/trip-generation/orchestrator.js`
- Modify: `backend/test/backend-contract.test.js`

- [ ] **Step 1: Write the failing test that forces AI-enhanced success and validator fallback**

Add two tests:

```js
test('ai enhancement upgrades the response to ai_enhanced when validator passes', async () => {
  const { server } = await buildServer();
  const generatorModule = await import('../src/ai/generator.js');
  const originalEnhance = generatorModule.aiGenerator.enhanceTripSkeleton;

  generatorModule.aiGenerator.enhanceTripSkeleton = async ({ skeleton }) => ({
    ...skeleton,
    itinerary: skeleton.itinerary.map((day) => ({
      ...day,
      items: day.items.map((item) => (
        item.type === 'spot'
          ? { ...item, description: 'Enhanced description' }
          : item.type === 'food'
            ? { ...item, recommend: 'Enhanced dish' }
            : { ...item, reason: 'Enhanced stay reason' }
      ))
    }))
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'ai_enhanced');
  } finally {
    generatorModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    await server.close();
  }
});

test('validator rejects polluted ai output and keeps rule_based response', async () => {
  const { server } = await buildServer();
  const generatorModule = await import('../src/ai/generator.js');
  const originalEnhance = generatorModule.aiGenerator.enhanceTripSkeleton;

  generatorModule.aiGenerator.enhanceTripSkeleton = async ({ skeleton }) => ({
    ...skeleton,
    itinerary: skeleton.itinerary.map((day) => ({
      ...day,
      items: day.items.map((item) => ({ ...item, name: '[object Object]' }))
    }))
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relax']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().generation_meta.warnings.includes('ai_result_rejected'), true);
  } finally {
    generatorModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    await server.close();
  }
});
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js --test-name-pattern "ai enhancement upgrades|validator rejects"
```

Expected:

```text
FAIL because enhanceTripSkeleton does not exist and the orchestrator never attempts AI enhancement
```

- [ ] **Step 3: Add AI enhancement support to the generator**

Extend `backend/src/ai/generator.js` with:

```js
async function enhanceTripSkeleton({ request, skeleton, pois }) {
  const prompt = [
    `目的地：${request.destinations.map((item) => item.name).join('、')}`,
    `开始日期：${request.start_date}`,
    `天数：${request.days}`,
    `偏好：${request.preferences.join('、')}`,
    `请只补全已有行程项的描述字段，不要改天数、不要新增陌生地点。`,
    JSON.stringify(skeleton)
  ].join('\n');

  const text = await callMiniMax(prompt, TRIP_SYSTEM);
  return parseJSON(text);
}

export const aiGenerator = { generateTrip, generateRecommendations, enhanceTripSkeleton };
```

- [ ] **Step 4: Create the validator**

Create `backend/src/services/trip-generation/resultValidator.js`:

```js
const INVALID_TOKENS = ['[object Object]', 'undefined', 'null', '待补'];

export class TripResultValidator {
  validate(result, expectedDays) {
    const issues = [];
    if (!Array.isArray(result.itinerary) || result.itinerary.length !== expectedDays) {
      issues.push('day_count_mismatch');
    }

    for (const day of result.itinerary || []) {
      if (!Array.isArray(day.items) || day.items.length === 0) {
        issues.push('empty_day');
        continue;
      }

      for (const item of day.items) {
        if (!item.type || !item.name) issues.push('missing_required_field');
        if (INVALID_TOKENS.some((token) => String(item.name || '').includes(token))) {
          issues.push('polluted_item_name');
        }
      }
    }

    return {
      valid: issues.length === 0,
      severity: issues.length === 0 ? 'pass' : 'fallback_required',
      issues
    };
  }
}
```

- [ ] **Step 5: Create the AI enhancer adapter**

Create `backend/src/services/trip-generation/aiEnhancer.js`:

```js
import { aiGenerator } from '../../ai/generator.js';

export class TripAIEnhancer {
  async enhance({ request, skeleton, candidates }) {
    if (process.env.SKIP_AI === 'true') {
      return skeleton;
    }

    return aiGenerator.enhanceTripSkeleton({
      request,
      skeleton,
      pois: candidates
    });
  }
}
```

- [ ] **Step 6: Update the orchestrator to try AI, validate, and fall back**

Replace the simplified return path in `backend/src/services/trip-generation/orchestrator.js` with:

```js
const skeleton = await this.skeletonBuilder.build(request, candidates);

try {
  const enhanced = await this.aiEnhancer.enhance({ request, skeleton, candidates });
  const enhancedResult = {
    trip_id: skeleton.trip_id,
    title: skeleton.title,
    source: 'ai_enhanced',
    fallback_level: 'none',
    generation_meta: createGenerationMeta({
      phase: 'ready',
      used_ai: true
    }),
    destinations: request.destinations,
    start_date: request.start_date,
    days: request.days,
    itinerary: enhanced.itinerary
  };

  const validation = this.resultValidator.validate(enhancedResult, request.days);
  if (validation.valid) {
    return enhancedResult;
  }
} catch (error) {
}

const ruleBasedResult = {
  trip_id: skeleton.trip_id,
  title: skeleton.title,
  source: 'rule_based',
  fallback_level: 'rule_based',
  generation_meta: createGenerationMeta({
    phase: 'degraded',
    used_rule_fallback: true,
    warnings: ['ai_result_rejected']
  }),
  destinations: request.destinations,
  start_date: request.start_date,
  days: request.days,
  itinerary: skeleton.itinerary
};

const ruleValidation = this.resultValidator.validate(ruleBasedResult, request.days);
if (ruleValidation.valid) {
  return ruleBasedResult;
}
```

- [ ] **Step 7: Run the full backend test suite**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js
```

Expected:

```text
all backend contract tests pass
```

- [ ] **Step 8: Commit the AI enhancement and validation layer**

```bash
git add backend/src/ai/generator.js backend/src/services/trip-generation/aiEnhancer.js backend/src/services/trip-generation/resultValidator.js backend/src/services/trip-generation/orchestrator.js backend/test/backend-contract.test.js
git commit -m "feat: validate and enhance generated trip results"
```

---

### Task 5: Add Frontend Generation State Modeling and Degraded UI Messaging

**Files:**
- Create: `frontend/pages/plan/result/generation-state.js`
- Create: `frontend/test/trip-generation-state.test.mjs`
- Modify: `frontend/pages/plan/result/result.js`
- Modify: `frontend/pages/plan/result/result.wxml`
- Modify: `frontend/pages/plan/result/result.wxss`
- Modify: `frontend/services/trip.js`
- Modify: `frontend/services/api.js`

- [ ] **Step 1: Write the failing frontend state helper test**

Create `frontend/test/trip-generation-state.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGenerationState } from '../pages/plan/result/generation-state.js';

test('normalizeGenerationState returns degraded state for rule_based responses', () => {
  const state = normalizeGenerationState({
    source: 'rule_based',
    fallback_level: 'rule_based',
    generation_meta: { phase: 'degraded', warnings: ['ai_result_rejected'] }
  });

  assert.deepEqual(state, {
    phase: 'degraded',
    fallbackLevel: 'rule_based',
    bannerText: '已先为你生成一版基础可编辑行程，你可以继续调整顺序、替换内容或添加备注。'
  });
});

test('normalizeGenerationState returns ready state for ai_enhanced responses', () => {
  const state = normalizeGenerationState({
    source: 'ai_enhanced',
    fallback_level: 'none',
    generation_meta: { phase: 'ready', warnings: [] }
  });

  assert.equal(state.phase, 'ready');
  assert.equal(state.bannerText, '');
});
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run:

```bash
cmd /c npx node@20 --test frontend/test/trip-generation-state.test.mjs
```

Expected:

```text
FAIL because generation-state.js does not exist
```

- [ ] **Step 3: Implement the generation state helper**

Create `frontend/pages/plan/result/generation-state.js`:

```js
const BANNERS = {
  rule_based: '已先为你生成一版基础可编辑行程，你可以继续调整顺序、替换内容或添加备注。',
  template: '当前目的地可用数据较少，先为你生成一版参考行程，后续可继续编辑完善。'
};

export function normalizeGenerationState(trip = {}) {
  const fallbackLevel = trip.fallback_level || 'none';
  const source = trip.source || 'ai_enhanced';
  const phase = source === 'ai_enhanced' ? 'ready' : fallbackLevel === 'none' ? 'ready' : 'degraded';

  return {
    phase,
    fallbackLevel,
    bannerText: BANNERS[fallbackLevel] || ''
  };
}
```

- [ ] **Step 4: Update the trip result page state and load flow**

Modify `frontend/pages/plan/result/result.js` to add:

```js
import { normalizeGenerationState } from './generation-state.js';

data: {
  trip: null,
  tripId: null,
  phase: 'idle',
  step: 'validating',
  fallbackLevel: 'none',
  bannerText: '',
  loading: true,
  generatingText: '正在检查出行条件...',
  currentDay: -1,
  error: null,
  pageBackground: getCityBackground()
}
```

Replace `setTripState` with:

```js
setTripState(trip, tripId = null) {
  const generationState = normalizeGenerationState(trip);
  this.setData({
    trip,
    tripId: tripId || trip?.trip_id || this.data.tripId,
    loading: false,
    error: null,
    currentDay: trip?.itinerary?.length ? 0 : -1,
    pageBackground: getCityBackground(trip?.destinations),
    phase: generationState.phase,
    fallbackLevel: generationState.fallbackLevel,
    bannerText: generationState.bannerText
  });
}
```

Update the generation phase text transitions:

```js
this.setData({ loading: true, error: null, phase: 'generating', step: 'fetching_pois', generatingText: '正在搜索景点与餐饮...' });
await new Promise((resolve) => setTimeout(resolve, 300));
this.setData({ step: 'building_skeleton', generatingText: '正在安排每日行程...' });
await new Promise((resolve) => setTimeout(resolve, 300));
this.setData({ step: 'enhancing', generatingText: '正在补充推荐内容...' });
```

- [ ] **Step 5: Render the degraded banner and clearer loading copy**

Modify `frontend/pages/plan/result/result.wxml`:

```xml
<view class="loading-state" wx:if="{{loading}}">
  <view class="loading-icon">PLAN</view>
  <text class="loading-text">{{generatingText}}</text>
</view>

<view class="generation-banner" wx:if="{{bannerText}}">
  <text class="generation-banner__text">{{bannerText}}</text>
</view>
```

Modify `frontend/pages/plan/result/result.wxss`:

```css
.generation-banner {
  margin-bottom: 20rpx;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: rgba(20, 136, 87, 0.08);
  border: 1rpx solid rgba(20, 136, 87, 0.16);
}

.generation-banner__text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #1f5c45;
}
```

- [ ] **Step 6: Keep the service layer compatible with product-state responses**

`frontend/services/trip.js` already returns the backend payload as-is. Only adjust `frontend/services/api.js` so that non-200 responses still preserve `retryable` and `message`:

```js
reject({
  ...(typeof res.data === 'object' ? res.data : {}),
  statusCode: res.statusCode
});
```

- [ ] **Step 7: Run the frontend helper test and syntax checks**

Run:

```bash
cmd /c npx node@20 --test frontend/test/trip-generation-state.test.mjs
cmd /c npx node@20 --check frontend/pages/plan/result/result.js
cmd /c npx node@20 --check frontend/pages/plan/result/generation-state.js
cmd /c npx node@20 --check frontend/services/api.js
```

Expected:

```text
frontend state helper test passes
all --check commands exit with code 0
```

- [ ] **Step 8: Commit the frontend generation-state work**

```bash
git add frontend/pages/plan/result/generation-state.js frontend/test/trip-generation-state.test.mjs frontend/pages/plan/result/result.js frontend/pages/plan/result/result.wxml frontend/pages/plan/result/result.wxss frontend/services/api.js
git commit -m "feat: surface trip generation degraded states in result page"
```

---

### Task 6: Final Verification, Spec Sync, and Release Readiness

**Files:**
- Modify: `docs/superpowers/specs/2026-04-24-trip-generation-stability-design.md`

- [ ] **Step 1: Update the design doc with implemented file names**

Add a short implementation note near the end of `docs/superpowers/specs/2026-04-24-trip-generation-stability-design.md`:

```md
## 9. Implementation Mapping

- Backend orchestration: `backend/src/services/trip-generation/orchestrator.js`
- Candidate preparation: `backend/src/services/trip-generation/candidateService.js`
- Rule-based skeletons: `backend/src/services/trip-generation/skeletonBuilder.js`
- AI enhancement: `backend/src/services/trip-generation/aiEnhancer.js`
- Validation: `backend/src/services/trip-generation/resultValidator.js`
- Template fallback: `backend/src/services/trip-generation/fallbackTemplateProvider.js`
- Frontend state adapter: `frontend/pages/plan/result/generation-state.js`
```

- [ ] **Step 2: Run the full verification suite**

Run:

```bash
cmd /c npx node@20 --test backend/test/backend-contract.test.js
cmd /c npx node@20 --test frontend/test/plan-params-selection.test.mjs
cmd /c npx node@20 --test frontend/test/trip-generation-state.test.mjs
cmd /c npx node@20 --check backend/src/services/tripService.js
cmd /c npx node@20 --check backend/src/services/trip-generation/orchestrator.js
cmd /c npx node@20 --check backend/src/services/trip-generation/candidateService.js
cmd /c npx node@20 --check backend/src/services/trip-generation/skeletonBuilder.js
cmd /c npx node@20 --check backend/src/services/trip-generation/aiEnhancer.js
cmd /c npx node@20 --check backend/src/services/trip-generation/resultValidator.js
cmd /c npx node@20 --check backend/src/services/trip-generation/fallbackTemplateProvider.js
cmd /c npx node@20 --check frontend/pages/plan/result/result.js
cmd /c npx node@20 --check frontend/pages/plan/result/generation-state.js
cmd /c npx node@20 --check frontend/services/trip.js
cmd /c npx node@20 --check frontend/services/api.js
```

Expected:

```text
all tests pass
all syntax checks exit with code 0
```

- [ ] **Step 3: Manually verify the user-visible states in the mini-program**

Walk these flows in the WeChat devtools:

1. Normal generation:
   - Fill params
   - Click generate
   - Confirm no degraded banner

2. AI degraded generation:
   - Temporarily set backend to skip AI
   - Confirm the rule-based banner appears

3. Weak-candidate template generation:
   - Use a low-data destination or mock empty POIs
   - Confirm the template banner appears

4. Hard failure:
   - Force backend 503
   - Confirm result page shows retry entry instead of a half-empty itinerary

- [ ] **Step 4: Commit the verification-ready state**

```bash
git add docs/superpowers/specs/2026-04-24-trip-generation-stability-design.md
git commit -m "docs: map trip generation stability design to implementation"
```

---

## Self-Review

### Spec coverage

- Staged orchestration: covered by Tasks 2, 3, and 4.
- Rule skeleton + AI enhancement + validator + fallback: covered by Tasks 3 and 4.
- Frontend degraded states and user messages: covered by Task 5.
- Error body and retryable semantics: covered by Task 2.
- Verification and visible flows: covered by Task 6.

No spec section is left without a corresponding task.

### Placeholder scan

- No placeholder markers or deferred implementation steps remain.
- Every task lists exact file paths.
- Each code-changing step includes concrete code blocks.
- Every test step has an exact command and expected failure or success condition.

### Type consistency

- Backend result fields stay consistent across tasks: `source`, `fallback_level`, `generation_meta`, `itinerary`.
- Frontend state helper consumes the same names introduced by backend tasks.
- The orchestrator remains the single entry point for `tripService.generate` throughout the plan.
