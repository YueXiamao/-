import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRegionDatabase,
  createRegionStore,
  REGION_DB_VERSION,
  REGION_STORAGE_KEY
} from '../services/region-db.js';

function createMemoryStorage(initial = {}) {
  const store = { ...initial };

  return {
    getStorageSync(key) {
      return store[key];
    },
    setStorageSync(key, value) {
      store[key] = value;
    },
    dump() {
      return store;
    }
  };
}

const sampleRecords = [
  { code: 'p1', name: 'Province One', level: 1, parentCode: '' },
  { code: 'c1', name: 'City One', level: 2, parentCode: 'p1' },
  { code: 'd1', name: 'District One', level: 3, parentCode: 'c1' }
];

test('region database builds table indexes for province city and district lookups', () => {
  const db = createRegionDatabase(sampleRecords);

  assert.deepEqual(db.tables.provinces.map((item) => item.code), ['p1']);
  assert.deepEqual(db.tables.citiesByProvince.p1.map((item) => item.code), ['c1']);
  assert.deepEqual(db.tables.districtsByCity.c1.map((item) => item.code), ['d1']);
});

test('region store persists a versioned local database and reuses it', () => {
  const storage = createMemoryStorage();
  const store = createRegionStore({ records: sampleRecords, storage });

  assert.deepEqual(store.getProvinces().map((item) => item.code), ['p1']);

  const persisted = storage.dump()[REGION_STORAGE_KEY];
  assert.equal(persisted.version, REGION_DB_VERSION);
  assert.deepEqual(persisted.tables.citiesByProvince.p1.map((item) => item.code), ['c1']);
});

test('region store rebuilds when a stored database version is stale', () => {
  const storage = createMemoryStorage({
    [REGION_STORAGE_KEY]: {
      version: 'old',
      tables: {
        provinces: [{ code: 'old', name: 'Old', level: 1, parentCode: '' }],
        citiesByProvince: {},
        districtsByCity: {}
      }
    }
  });
  const store = createRegionStore({ records: sampleRecords, storage });

  assert.deepEqual(store.getProvinces().map((item) => item.code), ['p1']);
});
