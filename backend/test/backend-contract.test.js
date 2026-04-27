import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before, beforeEach } from 'node:test';
import Fastify from 'fastify';

const tempDirsToCleanup = new Set();
let sharedContext;

process.once('exit', () => {
  for (const tmpDir of tempDirsToCleanup) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best effort at process exit.
    }
  }
});

async function buildServer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-mini-'));
  const previousEnv = {
    DB_PATH: process.env.DB_PATH,
    AMAP_KEY: process.env.AMAP_KEY,
    SKIP_EXTERNAL_POI: process.env.SKIP_EXTERNAL_POI,
    SKIP_AI: process.env.SKIP_AI
  };

  tempDirsToCleanup.add(tmpDir);
  process.env.DB_PATH = path.join(tmpDir, 'travel.db');
  process.env.AMAP_KEY = 'test-amap-key';
  process.env.SKIP_EXTERNAL_POI = 'true';
  process.env.SKIP_AI = 'true';

  const restoreEnvAndTempDir = () => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tempDirsToCleanup.delete(tmpDir);
    } catch {
      // Database handles can outlive the Fastify server during the test run.
    }
  };

  try {
    const { initDatabase, getDb } = await import('../src/db/database.js');
    const { errorHandler } = await import('../src/middleware/errorHandler.js');
    const destinationRoutes = (await import('../src/routes/destinations.js')).default;
    const discoverRoutes = (await import('../src/routes/discover.js')).default;
    const tripRoutes = (await import('../src/routes/trip.js')).default;
    const userRoutes = (await import('../src/routes/user.js')).default;

    initDatabase();

    const server = Fastify({ logger: false });
    server.setErrorHandler(errorHandler);
    server.register(destinationRoutes, { prefix: '/api/destinations' });
    server.register(discoverRoutes, { prefix: '/api/discover' });
    server.register(tripRoutes, { prefix: '/api/trip' });
    server.register(userRoutes, { prefix: '/api/user' });

    return {
      server,
      db: getDb(),
      tmpDir,
      async cleanup() {
        try {
          await server.close();
        } finally {
          try {
            const db = getDb();
            if (db && typeof db.close === 'function' && db.open) {
              db.close();
            }
          } catch {
            // Best effort at test teardown.
          }
          restoreEnvAndTempDir();
        }
      }
    };
  } catch (error) {
    restoreEnvAndTempDir();
    throw error;
  }
}

function assertGenerationMetaShape(payload) {
  assert.equal(typeof payload.source, 'string');
  assert.equal(typeof payload.fallback_level, 'string');
  assert.ok(payload.generation_meta && typeof payload.generation_meta === 'object');
  assert.equal(Array.isArray(payload.generation_meta), false);
  assert.equal(Object.getPrototypeOf(payload.generation_meta), Object.prototype);
  assert.equal(typeof payload.generation_meta.phase, 'string');
  assert.equal(Array.isArray(payload.generation_meta.warnings), true);
  assert.equal(
    payload.generation_meta.warnings.every((warning) => typeof warning === 'string'),
    true
  );
}

function resetDatabase(db) {
  db.exec(`
    DELETE FROM trip_item;
    DELETE FROM trip_day;
    DELETE FROM trip;
    DELETE FROM destination_tag;
    DELETE FROM destination;
    DELETE FROM poi;
    DELETE FROM user_preference;
    DELETE FROM region_data;
    DELETE FROM user;
    DELETE FROM sqlite_sequence;
  `);
}

before(async () => {
  sharedContext = await buildServer();
});

after(async () => {
  if (sharedContext) {
    await sharedContext.cleanup();
  }
});

beforeEach(() => {
  resetDatabase(sharedContext.db);
});

function testWithServer(name, fn) {
  test(name, async () => {
    await fn(sharedContext);
  });
}

testWithServer('missing trip parameters return validation error instead of crashing', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {}
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
});

testWithServer('trip generation rejects empty preferences via shared request normalization', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {
      destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
      start_date: '2026-05-01',
      days: 2,
      preferences: []
    }
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
});

testWithServer('trip generation rejects malformed day counts via shared request normalization', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {
      destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
      start_date: '2026-05-01',
      days: '2abc',
      preferences: ['Relaxed']
    }
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
});

testWithServer('trip generation rejects malformed start dates via shared request normalization', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {
      destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
      start_date: 'not-a-date',
      days: 2,
      preferences: ['Relaxed']
    }
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
});

testWithServer('trip generate route forwards ai_enhanced metadata returned by the service', async ({ server }) => {
  const tripModule = await import('../src/services/tripService.js');
  const originalGenerate = tripModule.tripService.generate;
  tripModule.tripService.generate = async () => ({
    trip_id: 'trip-enhanced',
    title: 'Enhanced Trip',
    source: 'ai_enhanced',
    fallback_level: 'none',
    generation_meta: {
      phase: 'ready',
      warnings: []
    },
    itinerary: []
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assertGenerationMetaShape(res.json());
    assert.equal(res.json().source, 'ai_enhanced');
    assert.equal(res.json().fallback_level, 'none');
    assert.equal(res.json().generation_meta.phase, 'ready');
  } finally {
    tripModule.tripService.generate = originalGenerate;
  }
});

testWithServer('trip generate route forwards rule_based fallback metadata returned by the service', async ({ server }) => {
  const tripModule = await import('../src/services/tripService.js');
  const originalGenerate = tripModule.tripService.generate;
  tripModule.tripService.generate = async () => ({
    trip_id: 'trip-rule-based',
    title: 'Rule-based Trip',
    source: 'rule_based',
    fallback_level: 'rule_based',
    generation_meta: {
      phase: 'degraded',
      warnings: ['ai_enhancement_failed']
    },
    itinerary: []
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Food']
      }
    });

    assert.equal(res.statusCode, 200);
    assertGenerationMetaShape(res.json());
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.deepEqual(res.json().generation_meta.warnings, ['ai_enhancement_failed']);
  } finally {
    tripModule.tripService.generate = originalGenerate;
  }
});

testWithServer('real trip generation response includes generation_meta and fallback_level', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {
      destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
      start_date: '2026-05-01',
      days: 2,
      preferences: ['Relaxed'],
      extra_notes: 'Keep it light'
    }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().source, 'rule_based');
  assert.equal(res.json().fallback_level, 'rule_based');
  assert.equal(res.json().generation_meta?.phase, 'degraded');
});

testWithServer('ai enhancement upgrades the response to ai_enhanced when validator passes', async ({ server }) => {
  const aiModule = await import('../src/ai/generator.js');
  const originalEnhance = aiModule.aiGenerator.enhanceTripSkeleton;
  const previousSkipAi = process.env.SKIP_AI;

  process.env.SKIP_AI = 'false';
  aiModule.aiGenerator.enhanceTripSkeleton = async ({ skeleton }) => {
    const itinerary = Array.isArray(skeleton) ? skeleton : skeleton.itinerary;

    return itinerary.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        if (item.type === 'spot') {
          return {
            ...item,
            description: '围绕核心景点安排游玩节奏，适合衔接当天主要路线。'
          };
        }

        if (item.type === 'food') {
          return {
            ...item,
            recommend: '推荐结合本地口味，安排在就近时段用餐。'
          };
        }

        if (item.type === 'hotel') {
          return {
            ...item,
            reason: '位置便于衔接当天路线，适合作为休息落点。'
          };
        }

        return item;
      })
    }));
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'ai_enhanced');
    assert.equal(res.json().fallback_level, 'none');
    assert.equal(res.json().generation_meta?.used_ai, true);
    assert.equal(res.json().generation_meta?.phase, 'ready');
  } finally {
    aiModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    process.env.SKIP_AI = previousSkipAi;
  }
});

testWithServer('validator rejects polluted ai output and keeps rule_based response', async ({ server }) => {
  const aiModule = await import('../src/ai/generator.js');
  const originalEnhance = aiModule.aiGenerator.enhanceTripSkeleton;
  const previousSkipAi = process.env.SKIP_AI;

  process.env.SKIP_AI = 'false';
  aiModule.aiGenerator.enhanceTripSkeleton = async ({ skeleton }) => {
    const itinerary = Array.isArray(skeleton) ? skeleton : skeleton.itinerary;

    return itinerary.map((day) => ({
      ...day,
      items: day.items.map((item) => ({
        ...item,
        name: '[object Object]'
      }))
    }));
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.equal(res.json().generation_meta?.phase, 'degraded');
    assert.equal(res.json().generation_meta?.warnings.includes('ai_result_rejected'), true);
  } finally {
    aiModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    process.env.SKIP_AI = previousSkipAi;
  }
});

test('validator rejects English narrative copy while allowing English names and addresses', async () => {
  const { TripResultValidator } = await import('../src/services/trip-generation/resultValidator.js');

  const report = new TripResultValidator().validate({
    itinerary: [
      {
        day: 1,
        date: '2026-05-01',
        items: [
          {
            type: 'spot',
            name: 'JW Garden',
            address: 'IFS Center',
            duration: '2-3h',
            description: 'Core sightseeing block for day 1.',
            transport_to_next: '地铁 A 口步行 5 分钟'
          }
        ]
      }
    ]
  }, { expectedDays: 1 });

  assert.equal(report.valid, false);
  assert.equal(
    report.issues.some((item) => (
      item.code === 'english_narrative_text'
        && item.path === 'itinerary[0].items[0].description'
    )),
    true
  );
  assert.equal(report.issues.some((item) => item.path === 'itinerary[0].items[0].name'), false);
  assert.equal(report.issues.some((item) => item.path === 'itinerary[0].items[0].address'), false);
  assert.equal(
    report.issues.some((item) => item.path === 'itinerary[0].items[0].transport_to_next'),
    false
  );
});

testWithServer('validator rejects ai output that removes existing product fields', async ({ server }) => {
  const aiModule = await import('../src/ai/generator.js');
  const originalEnhance = aiModule.aiGenerator.enhanceTripSkeleton;
  const previousSkipAi = process.env.SKIP_AI;

  process.env.SKIP_AI = 'false';
  aiModule.aiGenerator.enhanceTripSkeleton = async ({ skeleton }) => {
    const itinerary = Array.isArray(skeleton) ? skeleton : skeleton.itinerary;

    return itinerary.map((day) => ({
      day: day.day,
      date: day.date,
      items: day.items.map((item) => ({
        type: item.type,
        name: item.name,
        address: item.address
      }))
    }));
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.equal(res.json().generation_meta?.warnings.includes('ai_result_rejected'), true);
  } finally {
    aiModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    process.env.SKIP_AI = previousSkipAi;
  }
});

testWithServer('raw empty ai output falls back to rule_based response', async ({ server }) => {
  const aiModule = await import('../src/ai/generator.js');
  const originalEnhance = aiModule.aiGenerator.enhanceTripSkeleton;
  const previousSkipAi = process.env.SKIP_AI;

  process.env.SKIP_AI = 'false';
  aiModule.aiGenerator.enhanceTripSkeleton = async () => [];

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.equal(res.json().generation_meta?.phase, 'degraded');
    assert.equal(
      ['ai_enhancement_failed', 'ai_result_rejected'].some((warning) => (
        res.json().generation_meta?.warnings.includes(warning)
      )),
      true
    );
  } finally {
    aiModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    process.env.SKIP_AI = previousSkipAi;
  }
});

testWithServer('raw ai output that changes day or item identity falls back to rule_based response', async ({ server }) => {
  const aiModule = await import('../src/ai/generator.js');
  const originalEnhance = aiModule.aiGenerator.enhanceTripSkeleton;
  const previousSkipAi = process.env.SKIP_AI;

  process.env.SKIP_AI = 'false';
  aiModule.aiGenerator.enhanceTripSkeleton = async ({ skeleton }) => {
    const itinerary = Array.isArray(skeleton) ? skeleton : skeleton.itinerary;

    return itinerary.map((day, dayIndex) => ({
      ...day,
      day: dayIndex === 0 ? 99 : day.day,
      date: dayIndex === 0 ? '2099-01-01' : day.date,
      items: day.items.map((item, itemIndex) => ({
        ...item,
        type: dayIndex === 0 && itemIndex === 0 ? 'hotel' : item.type,
        name: dayIndex === 0 && itemIndex === 0 ? 'Changed Place' : item.name,
        address: dayIndex === 0 && itemIndex === 0 ? 'Changed Address' : item.address
      }))
    }));
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.equal(res.json().generation_meta?.phase, 'degraded');
    assert.equal(
      ['ai_enhancement_failed', 'ai_result_rejected'].some((warning) => (
        res.json().generation_meta?.warnings.includes(warning)
      )),
      true
    );
  } finally {
    aiModule.aiGenerator.enhanceTripSkeleton = originalEnhance;
    process.env.SKIP_AI = previousSkipAi;
  }
});

test('ai enhancement merge preserves skeleton structure and allowed copy fields only', async () => {
  const { mergeEnhancedItinerary } = await import('../src/ai/generator.js');
  const skeleton = [
    {
      day: 1,
      date: '2026-05-01',
      summary: 'Original day summary',
      items: [
        {
          type: 'spot',
          name: 'Wide Alley',
          address: 'Qingyang',
          duration: '2h',
          description: 'Original description',
          transport_to_next: 'Walk 8 min'
        },
        {
          type: 'food',
          name: 'Local Noodles',
          address: 'Center',
          budget: 'Flexible',
          recommend: 'Original recommend'
        }
      ]
    },
    {
      day: 2,
      date: '2026-05-02',
      items: [
        {
          type: 'hotel',
          name: 'Central Stay',
          address: 'Downtown',
          budget: 'To confirm',
          reason: 'Original reason'
        }
      ]
    }
  ];
  const aiOutput = [
    {
      day: 1,
      date: '2026-05-01',
      summary: 'Improved summary',
      items: [
        {
          type: 'spot',
          name: 'Wide Alley',
          address: 'Qingyang',
          duration: '3h',
          description: 'Improved description',
          transport_to_next: 'Taxi 12 min',
          unexpected: 'discard me'
        },
        {
          type: 'food',
          name: 'Local Noodles',
          address: 'Center',
          budget: '80 RMB',
          recommend: 'Improved recommend'
        }
      ]
    },
    {
      day: 2,
      date: '2026-05-02',
      items: [
        {
          type: 'hotel',
          name: 'Central Stay',
          address: 'Downtown',
          budget: '420 RMB',
          reason: 'Improved reason'
        }
      ]
    }
  ];

  const merged = mergeEnhancedItinerary(skeleton, aiOutput);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].day, 1);
  assert.equal(merged[0].date, '2026-05-01');
  assert.equal(merged[0].summary, 'Improved summary');
  assert.equal(merged[0].items.length, 2);
  assert.equal(merged[0].items[0].type, 'spot');
  assert.equal(merged[0].items[0].name, 'Wide Alley');
  assert.equal(merged[0].items[0].address, 'Qingyang');
  assert.equal(merged[0].items[0].description, 'Improved description');
  assert.equal(merged[0].items[0].duration, '3h');
  assert.equal(merged[0].items[0].transport_to_next, 'Taxi 12 min');
  assert.equal(merged[0].items[0].unexpected, undefined);
  assert.equal(merged[0].items[1].budget, '80 RMB');
  assert.equal(merged[0].items[1].recommend, 'Improved recommend');
  assert.equal(merged[1].items[0].budget, '420 RMB');
  assert.equal(merged[1].items[0].reason, 'Improved reason');
});

test('ai enhancement merge rejects empty raw ai itinerary', async () => {
  const { mergeEnhancedItinerary } = await import('../src/ai/generator.js');
  const skeleton = [
    {
      day: 1,
      date: '2026-05-01',
      items: [
        { type: 'spot', name: 'Wide Alley', address: 'Qingyang', description: 'Original' }
      ]
    }
  ];

  assert.throws(
    () => mergeEnhancedItinerary(skeleton, []),
    /AI enhancement changed itinerary structure/
  );
});

test('ai enhancement merge rejects changed day or item identity', async () => {
  const { mergeEnhancedItinerary } = await import('../src/ai/generator.js');
  const skeleton = [
    {
      day: 1,
      date: '2026-05-01',
      items: [
        { type: 'spot', name: 'Wide Alley', address: 'Qingyang', description: 'Original' }
      ]
    }
  ];

  assert.throws(
    () => mergeEnhancedItinerary(skeleton, [
      {
        day: 2,
        date: '2099-01-01',
        items: [
          {
            type: 'hotel',
            name: 'Changed Place',
            address: 'Changed Address',
            description: 'Improved'
          }
        ]
      }
    ]),
    /AI enhancement changed itinerary structure/
  );
});

test('ai enhancement merge rejects omitted baseline descriptive fields', async () => {
  const { mergeEnhancedItinerary } = await import('../src/ai/generator.js');
  const skeleton = [
    {
      day: 1,
      date: '2026-05-01',
      summary: 'Original day summary',
      items: [
        {
          type: 'spot',
          name: 'Wide Alley',
          address: 'Qingyang',
          duration: '2h',
          description: 'Original description',
          transport_to_next: 'Walk 8 min'
        },
        {
          type: 'food',
          name: 'Local Noodles',
          address: 'Center',
          budget: 'Flexible',
          recommend: 'Original recommend'
        },
        {
          type: 'hotel',
          name: 'Central Stay',
          address: 'Downtown',
          budget: 'To confirm',
          reason: 'Original reason'
        }
      ]
    }
  ];

  assert.throws(
    () => mergeEnhancedItinerary(skeleton, [
      {
        day: 1,
        date: '2026-05-01',
        items: [
          { type: 'spot', name: 'Wide Alley', address: 'Qingyang' },
          { type: 'food', name: 'Local Noodles', address: 'Center' },
          { type: 'hotel', name: 'Central Stay', address: 'Downtown' }
        ]
      }
    ]),
    /AI enhancement omitted baseline descriptive fields/
  );
});

testWithServer('candidate shortage still returns a non-empty rule_based itinerary', async ({ server }) => {
  const poiModule = await import('../src/services/poiService.js');
  const originalSearch = poiModule.poiService.search;
  const previousSkipExternalPoi = process.env.SKIP_EXTERNAL_POI;

  process.env.SKIP_EXTERNAL_POI = 'false';
  poiModule.poiService.search = async () => [];

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Low Data County', province: 'Test', city: 'Low Data County' }],
        start_date: '2026-05-01',
        days: 3,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'rule_based');
    assert.equal(res.json().fallback_level, 'rule_based');
    assert.equal(res.json().generation_meta?.phase, 'degraded');
    assert.deepEqual(res.json().generation_meta?.warnings, ['limited_poi_coverage', 'ai_skipped']);
    assert.equal(res.json().itinerary.length, 3);
    assert.equal(
      res.json().itinerary.every((day) => Array.isArray(day.items) && day.items.length > 0),
      true
    );
  } finally {
    poiModule.poiService.search = originalSearch;
    process.env.SKIP_EXTERNAL_POI = previousSkipExternalPoi;
  }
});

testWithServer('template fallback is returned when skeleton building throws', async ({ server }) => {
  const tripModule = await import('../src/services/tripService.js');
  const originalBuild = tripModule.tripService.orchestrator.skeletonBuilder.build;
  tripModule.tripService.orchestrator.skeletonBuilder.build = async () => {
    throw new Error('skeleton_builder_failed');
  };

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'fallback_template');
    assert.equal(res.json().fallback_level, 'template');
    assert.equal(res.json().generation_meta?.phase, 'degraded');
    assert.deepEqual(
      res.json().generation_meta?.warnings,
      ['skeleton_builder_failed', 'template_fallback']
    );
  } finally {
    tripModule.tripService.orchestrator.skeletonBuilder.build = originalBuild;
  }
});

testWithServer('template fallback is returned when skeleton builder returns an empty itinerary', async ({ server }) => {
  const tripModule = await import('../src/services/tripService.js');
  const originalBuild = tripModule.tripService.orchestrator.skeletonBuilder.build;
  tripModule.tripService.orchestrator.skeletonBuilder.build = async () => ({
    itinerary: [],
    warnings: ['invalid_skeleton']
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'fallback_template');
    assert.equal(res.json().fallback_level, 'template');
    assert.deepEqual(
      res.json().generation_meta?.warnings,
      ['invalid_rule_based_itinerary', 'template_fallback']
    );
    assert.equal(res.json().itinerary.length, 2);
    assert.equal(
      res.json().itinerary.every((day) => Array.isArray(day.items) && day.items.length > 0),
      true
    );
  } finally {
    tripModule.tripService.orchestrator.skeletonBuilder.build = originalBuild;
  }
});

testWithServer('template fallback is returned when skeleton builder returns days without items', async ({ server }) => {
  const tripModule = await import('../src/services/tripService.js');
  const originalBuild = tripModule.tripService.orchestrator.skeletonBuilder.build;
  tripModule.tripService.orchestrator.skeletonBuilder.build = async () => ({
    itinerary: [
      { day: 1, date: '2026-05-01', items: [] },
      { day: 2, date: '2026-05-02', items: [] }
    ],
    warnings: ['invalid_skeleton']
  });

  try {
    const res = await server.inject({
      method: 'POST',
      url: '/api/trip/generate',
      payload: {
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 2,
        preferences: ['Relaxed']
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().source, 'fallback_template');
    assert.equal(res.json().fallback_level, 'template');
    assert.deepEqual(
      res.json().generation_meta?.warnings,
      ['invalid_rule_based_itinerary', 'template_fallback']
    );
    assert.equal(
      res.json().itinerary.every((day) => Array.isArray(day.items) && day.items.length > 0),
      true
    );
  } finally {
    tripModule.tripService.orchestrator.skeletonBuilder.build = originalBuild;
  }
});

test('trip service wires Task 4 result validator into the orchestrator', async () => {
  const tripModule = await import('../src/services/tripService.js');
  assert.equal(typeof tripModule.tripService.orchestrator.resultValidator?.validate, 'function');
});

test('trip service wires Task 4 ai enhancer into the orchestrator', async () => {
  const tripModule = await import('../src/services/tripService.js');
  assert.equal(typeof tripModule.tripService.orchestrator.aiEnhancer?.enhance, 'function');
});

test('trip service no longer exposes legacy fallback template helper', async () => {
  const tripModule = await import('../src/services/tripService.js');
  assert.equal(tripModule.tripService.getFallbackTemplate, undefined);
});

test('task 3 sparse itinerary copy stays neutral for users', async () => {
  const { TripSkeletonBuilder } = await import('../src/services/trip-generation/skeletonBuilder.js');
  const { FallbackTemplateProvider } = await import('../src/services/trip-generation/fallbackTemplateProvider.js');

  const request = {
    destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
    start_date: '2026-05-01',
    days: 1
  };

  const sparseResult = new TripSkeletonBuilder().build(request, {
    spots: [],
    foods: [],
    hotels: [],
    coverage: { level: 'weak' }
  });
  const templateResult = new FallbackTemplateProvider().provide(request, {
    reason: 'skeleton_builder_failed'
  });

  const sparseText = JSON.stringify(sparseResult.itinerary[0]);
  const templateText = JSON.stringify(templateResult.itinerary[0]);

  assert.equal(/rule-based|placeholder|live poi coverage/i.test(sparseText), false);
  assert.equal(/template|placeholder|generation recovers|fallback/i.test(templateText), false);
});

test('sparse and template itinerary narrative copy is Chinese first', async () => {
  const { TripSkeletonBuilder } = await import('../src/services/trip-generation/skeletonBuilder.js');
  const { FallbackTemplateProvider } = await import('../src/services/trip-generation/fallbackTemplateProvider.js');

  const request = {
    destinations: [{ name: 'Low Data County', province: 'Test', city: 'Low Data County' }],
    start_date: '2026-05-01',
    days: 1
  };

  const sparseResult = new TripSkeletonBuilder().build(request, {
    spots: [],
    foods: [],
    hotels: [],
    coverage: { level: 'weak' }
  });
  const templateResult = new FallbackTemplateProvider().provide(request);
  const narrativeValues = [
    ...sparseResult.itinerary[0].items,
    ...templateResult.itinerary[0].items
  ].flatMap((item) => [
    item.description,
    item.recommend,
    item.reason,
    item.transport_to_next
  ]).filter(Boolean);

  assert.equal(narrativeValues.every((value) => !/[A-Za-z]{2,}/.test(value)), true);
});

testWithServer('trip generation returns a retryable product error when every fallback fails', async ({ server }) => {
  const tripModule = await import('../src/services/tripService.js');
  const originalGenerate = tripModule.tripService.generate;
  tripModule.tripService.generate = async () => {
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
        preferences: ['Photo']
      }
    });

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().code, 30001);
    assert.equal(res.json().retryable, true);
    assert.equal(res.json().message, 'trip_generation_failed');
  } finally {
    tripModule.tripService.generate = originalGenerate;
  }
});

testWithServer('missing discover parameters return validation error instead of crashing', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/discover/recommend',
    payload: {}
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
});

testWithServer('destination search accepts the frontend q query parameter', async ({ server, db }) => {
  db.prepare(`
    INSERT INTO destination (name, province, city, level, hot_score)
    VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
  `).run('成都市', '四川省', '成都市', 'city', 10, '上海市', '上海市', '上海市', 'city', 1);

  const res = await server.inject({
    method: 'GET',
    url: '/api/destinations/search?q=成都'
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().map((item) => item.name), ['成都市']);
});

testWithServer('trip save and item note update use awaited user lookup and frontend route shape', async ({ server, db }) => {
  db.prepare('INSERT INTO user (openid) VALUES (?)').run('openid-1');

  const tripPayload = {
    title: '成都2日游',
    destinations: [{ name: '成都市', province: '四川省', city: '成都市' }],
    start_date: '2026-05-01',
    days: 2,
    preferences: ['轻松度假'],
    itinerary: [
      {
        day: 1,
        date: '2026-05-01',
        items: [
          { type: 'spot', name: '宽窄巷子', address: '成都市青羊区', duration: '2小时' }
        ]
      }
    ]
  };

  const saveRes = await server.inject({
    method: 'POST',
    url: '/api/trip/save',
    headers: { 'x-openid': 'openid-1' },
    payload: tripPayload
  });
  assert.equal(saveRes.statusCode, 200);

  const savedTripId = saveRes.json().trip_id;
  const detailRes = await server.inject({
    method: 'GET',
    url: `/api/trip/${savedTripId}`,
    headers: { 'x-openid': 'openid-1' }
  });
  const itemId = detailRes.json().itinerary[0].items[0].id;

  const patchRes = await server.inject({
    method: 'PATCH',
    url: `/api/trip/${savedTripId}/item/${itemId}`,
    headers: { 'x-openid': 'openid-1' },
    payload: { notes: '下午人少时去' }
  });

  assert.equal(patchRes.statusCode, 200);
  assert.equal(patchRes.json().success, true);

  const updated = db.prepare('SELECT notes FROM trip_item WHERE id = ?').get(itemId);
  assert.equal(updated.notes, '下午人少时去');
});

testWithServer('trip item deletion persists through the frontend route shape', async ({ server, db }) => {
  db.prepare('INSERT INTO user (openid) VALUES (?)').run('openid-delete');

  const saveRes = await server.inject({
    method: 'POST',
    url: '/api/trip/save',
    headers: { 'x-openid': 'openid-delete' },
    payload: {
      title: '成都1日游',
      destinations: [{ name: '成都市', province: '四川省', city: '成都市' }],
      start_date: '2026-05-01',
      days: 1,
      preferences: ['寻找美食'],
      itinerary: [
        {
          day: 1,
          date: '2026-05-01',
          items: [
            { type: 'spot', name: '宽窄巷子' },
            { type: 'food', name: '龙抄手' }
          ]
        }
      ]
    }
  });
  const tripId = saveRes.json().trip_id;
  const itemId = db.prepare(`
    SELECT ti.id
    FROM trip_item ti
    JOIN trip_day td ON td.id = ti.trip_day_id
    WHERE td.trip_id = ? AND ti.name = ?
  `).get(tripId, '龙抄手').id;

  const deleteRes = await server.inject({
    method: 'DELETE',
    url: `/api/trip/${tripId}/item/${itemId}`,
    headers: { 'x-openid': 'openid-delete' }
  });

  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.json().success, true);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM trip_item WHERE id = ?').get(itemId).count, 0);
});

testWithServer('trip item reorder swaps persisted sort order within the same day', async ({ server, db }) => {
  db.prepare('INSERT INTO user (openid) VALUES (?)').run('openid-reorder');

  const saveRes = await server.inject({
    method: 'POST',
    url: '/api/trip/save',
    headers: { 'x-openid': 'openid-reorder' },
    payload: {
      title: 'Reorder Trip',
      destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
      start_date: '2026-05-01',
      days: 1,
      preferences: ['Relax'],
      itinerary: [
        {
          day: 1,
          date: '2026-05-01',
          items: [
            { type: 'spot', name: 'Stop A', address: 'A street' },
            { type: 'food', name: 'Stop B', address: 'B street' },
            { type: 'hotel', name: 'Stop C', address: 'C street' }
          ]
        }
      ]
    }
  });

  const tripId = saveRes.json().trip_id;
  const itemsBefore = db.prepare(`
    SELECT ti.id, ti.name, ti.sort_order
    FROM trip_item ti
    JOIN trip_day td ON td.id = ti.trip_day_id
    WHERE td.trip_id = ?
    ORDER BY ti.sort_order
  `).all(tripId);

  const moveRes = await server.inject({
    method: 'PATCH',
    url: `/api/trip/${tripId}/item/${itemsBefore[0].id}/reorder`,
    headers: { 'x-openid': 'openid-reorder' },
    payload: { direction: 'down' }
  });

  assert.equal(moveRes.statusCode, 200);
  assert.equal(moveRes.json().success, true);

  const itemsAfter = db.prepare(`
    SELECT ti.name, ti.sort_order
    FROM trip_item ti
    JOIN trip_day td ON td.id = ti.trip_day_id
    WHERE td.trip_id = ?
    ORDER BY ti.sort_order
  `).all(tripId);

  assert.deepEqual(
    itemsAfter.map((item) => item.name),
    ['Stop B', 'Stop A', 'Stop C']
  );
});

testWithServer('trip item replacement updates persisted item content with a new candidate', async ({ server, db }) => {
  db.prepare('INSERT INTO user (openid) VALUES (?)').run('openid-replace');

  const poiModule = await import('../src/services/poiService.js');
  const originalSearch = poiModule.poiService.search;
  poiModule.poiService.search = async () => ([
    {
      gaode_id: 'poi-old',
      name: 'Wide Alley',
      address: 'Qingyang district',
      type: 'spot',
      city: 'Chengdu',
      photos: []
    },
    {
      gaode_id: 'poi-new',
      name: 'People Park',
      address: 'Central Chengdu',
      type: 'spot',
      city: 'Chengdu',
      photos: []
    }
  ]);

  try {
    const saveRes = await server.inject({
      method: 'POST',
      url: '/api/trip/save',
      headers: { 'x-openid': 'openid-replace' },
      payload: {
        title: 'Replace Trip',
        destinations: [{ name: 'Chengdu', province: 'Sichuan', city: 'Chengdu' }],
        start_date: '2026-05-01',
        days: 1,
        preferences: ['Photo'],
        itinerary: [
          {
            day: 1,
            date: '2026-05-01',
            items: [
              {
                type: 'spot',
                name: 'Wide Alley',
                address: 'Old address',
                description: 'Original description',
                duration: '2h',
                notes: 'Keep this note'
              }
            ]
          }
        ]
      }
    });

    const tripId = saveRes.json().trip_id;
    const itemId = db.prepare(`
      SELECT ti.id
      FROM trip_item ti
      JOIN trip_day td ON td.id = ti.trip_day_id
      WHERE td.trip_id = ?
    `).get(tripId).id;

    const replaceRes = await server.inject({
      method: 'POST',
      url: `/api/trip/${tripId}/item/${itemId}/replace`,
      headers: { 'x-openid': 'openid-replace' }
    });

    assert.equal(replaceRes.statusCode, 200);
    assert.equal(replaceRes.json().success, true);

    const updated = db.prepare('SELECT name, address, notes FROM trip_item WHERE id = ?').get(itemId);
    assert.equal(updated.name, 'People Park');
    assert.equal(updated.address, 'Central Chengdu');
    assert.equal(updated.notes, 'Keep this note');
  } finally {
    poiModule.poiService.search = originalSearch;
  }
});

testWithServer('discover destination can be converted directly into a trip', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/discover/%E6%88%90%E9%83%BD%E5%B8%82/trip',
    payload: {
      days: 2,
      start_date: '2026-05-01',
      preferences: ['轻松度假'],
      extra_notes: '安排轻松一点'
    }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().title, '成都市2日游');
  assert.equal(res.json().itinerary.length, 2);
});

testWithServer('app errors expose product error codes in the response body', async ({ server }) => {
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/save',
    headers: { 'x-openid': 'missing-user' },
    payload: {}
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, 10003);
});
