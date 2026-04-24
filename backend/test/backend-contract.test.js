import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';

async function buildServer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-mini-'));
  process.env.DB_PATH = path.join(tmpDir, 'travel.db');
  process.env.AMAP_KEY = 'test-amap-key';
  process.env.SKIP_EXTERNAL_POI = 'true';
  process.env.SKIP_AI = 'true';

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

  return { server, db: getDb(), tmpDir };
}

test('missing trip parameters return validation error instead of crashing', async () => {
  const { server } = await buildServer();
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/generate',
    payload: {}
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
  await server.close();
});

test('missing discover parameters return validation error instead of crashing', async () => {
  const { server } = await buildServer();
  const res = await server.inject({
    method: 'POST',
    url: '/api/discover/recommend',
    payload: {}
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 10001);
  await server.close();
});

test('destination search accepts the frontend q query parameter', async () => {
  const { server, db } = await buildServer();
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
  await server.close();
});

test('trip save and item note update use awaited user lookup and frontend route shape', async () => {
  const { server, db } = await buildServer();
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
  await server.close();
});

test('trip item deletion persists through the frontend route shape', async () => {
  const { server, db } = await buildServer();
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
  await server.close();
});

test('trip item reorder swaps persisted sort order within the same day', async () => {
  const { server, db } = await buildServer();
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
  await server.close();
});

test('trip item replacement updates persisted item content with a new candidate', async () => {
  const { server, db } = await buildServer();
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
    await server.close();
  }
});

test('discover destination can be converted directly into a trip', async () => {
  const { server } = await buildServer();
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
  await server.close();
});

test('app errors expose product error codes in the response body', async () => {
  const { server } = await buildServer();
  const res = await server.inject({
    method: 'POST',
    url: '/api/trip/save',
    headers: { 'x-openid': 'missing-user' },
    payload: {}
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().code, 10003);
  await server.close();
});
