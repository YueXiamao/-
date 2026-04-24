import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';

const tempDirsToCleanup = new Set();

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

function testWithServer(name, fn) {
  test(name, async () => {
    const context = await buildServer();
    try {
      await fn(context);
    } finally {
      await context.cleanup();
    }
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
