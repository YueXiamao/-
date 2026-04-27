import { REGION_DATA } from '../constants/region-data.js';

export const REGION_DB_VERSION = 'region-db-2026-04-27-v1';
export const REGION_STORAGE_KEY = 'travel_region_db_v1';

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

export function createRegionStore({ records = REGION_DATA, storage = getDefaultStorage() } = {}) {
  let memoryDb = null;

  function loadDatabase() {
    if (memoryDb) return memoryDb;

    memoryDb = readStoredDatabase(storage) || createRegionDatabase(records);
    writeStoredDatabase(storage, memoryDb);
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
