import { REGION_DATA } from '../constants/region-data.js';

export const REGION_DB_VERSION = 'region-db-2026-04-29-v2';
export const REGION_STORAGE_KEY = 'travel_region_db_v1';

const POPULAR_PROVINCE_CODES = [
  '110000',
  '310000',
  '440000',
  '330000',
  '320000',
  '510000',
  '500000',
  '530000',
  '460000',
  '350000',
  '610000',
  '420000',
  '430000',
  '370000',
  '410000',
  '120000',
  '130000',
  '210000'
];

const POPULAR_CITY_CODES = [
  '110100',
  '310100',
  '440100',
  '440300',
  '330100',
  '320100',
  '510100',
  '500100',
  '610100',
  '420100',
  '430100',
  '320500',
  '120100',
  '370200',
  '350200',
  '460200',
  '530100',
  '530700',
  '532900',
  '450300',
  '210200',
  '370100',
  '410100',
  '340100'
];

const popularProvinceRank = new Map(POPULAR_PROVINCE_CODES.map((code, index) => [code, index]));
const popularCityRank = new Map(POPULAR_CITY_CODES.map((code, index) => [code, index]));

function normalizeCode(value) {
  return String(value || '');
}

function normalizeRecord(record) {
  return {
    ...record,
    code: normalizeCode(record.code),
    parentCode: normalizeCode(record.parentCode)
  };
}

function pushToTable(table, key, value) {
  if (!table[key]) table[key] = [];
  table[key].push(value);
}

function compareByNameThenCode(a, b) {
  const byName = String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
  return byName || String(a.code || '').localeCompare(String(b.code || ''));
}

function compareWithPopularRank(rankMap) {
  return (a, b) => {
    const rankA = rankMap.has(a.code) ? rankMap.get(a.code) : Number.POSITIVE_INFINITY;
    const rankB = rankMap.has(b.code) ? rankMap.get(b.code) : Number.POSITIVE_INFINITY;

    if (rankA !== rankB) return rankA - rankB;
    return compareByNameThenCode(a, b);
  };
}

function sortTables(tables) {
  tables.provinces.sort(compareWithPopularRank(popularProvinceRank));

  for (const provinceCode of Object.keys(tables.citiesByProvince)) {
    tables.citiesByProvince[provinceCode].sort(compareWithPopularRank(popularCityRank));
  }

  for (const cityCode of Object.keys(tables.districtsByCity)) {
    tables.districtsByCity[cityCode].sort(compareByNameThenCode);
  }
}

export function createRegionDatabase(records = REGION_DATA) {
  const tables = {
    provinces: [],
    citiesByProvince: {},
    districtsByCity: {}
  };

  for (const rawRecord of records) {
    const record = normalizeRecord(rawRecord);

    if (record.level === 1) {
      tables.provinces.push(record);
    } else if (record.level === 2) {
      pushToTable(tables.citiesByProvince, record.parentCode, record);
    } else if (record.level === 3) {
      pushToTable(tables.districtsByCity, record.parentCode, record);
    }
  }

  sortTables(tables);

  return {
    version: REGION_DB_VERSION,
    tables
  };
}

function getDefaultStorage() {
  return typeof wx !== 'undefined' ? wx : null;
}

function isValidDatabase(db) {
  return db?.version === REGION_DB_VERSION
    && Array.isArray(db?.tables?.provinces)
    && db.tables.citiesByProvince
    && db.tables.districtsByCity;
}

function readStoredDatabase(storage) {
  if (!storage?.getStorageSync) return null;

  try {
    const stored = storage.getStorageSync(REGION_STORAGE_KEY);
    return isValidDatabase(stored) ? stored : null;
  } catch (error) {
    return null;
  }
}

function writeStoredDatabase(storage, db) {
  if (!storage?.setStorageSync) return;

  try {
    storage.setStorageSync(REGION_STORAGE_KEY, db);
  } catch (error) {
    // Storage can fail in restricted runtimes; the in-memory table still works.
  }
}

export function createRegionStore({
  records = REGION_DATA,
  storage = getDefaultStorage(),
  persist = false
} = {}) {
  let memoryDb = null;

  function loadDatabase() {
    if (memoryDb) return memoryDb;

    memoryDb = (persist ? readStoredDatabase(storage) : null) || createRegionDatabase(records);
    if (persist) writeStoredDatabase(storage, memoryDb);
    return memoryDb;
  }

  return {
    getDatabase() {
      return loadDatabase();
    },

    getProvinces() {
      return [...loadDatabase().tables.provinces];
    },

    getCities(provinceCode) {
      return [...(loadDatabase().tables.citiesByProvince[normalizeCode(provinceCode)] || [])];
    },

    getDistricts(cityCode) {
      return [...(loadDatabase().tables.districtsByCity[normalizeCode(cityCode)] || [])];
    },

    reset() {
      memoryDb = null;
    }
  };
}

const defaultRegionStore = createRegionStore();

export function getLocalProvinces() {
  return defaultRegionStore.getProvinces();
}

export function getLocalCities(provinceCode) {
  return defaultRegionStore.getCities(provinceCode);
}

export function getLocalDistricts(cityCode) {
  return defaultRegionStore.getDistricts(cityCode);
}

export default defaultRegionStore;
