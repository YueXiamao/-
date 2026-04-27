import assert from 'node:assert/strict';
import test from 'node:test';
import { createDestinationsService } from '../services/destinations.js';

function createFailingApi(calls = []) {
  return {
    async get(...args) {
      calls.push(args);
      throw new Error('backend unavailable');
    }
  };
}

const successfulEmptyApi = {
  async get() {
    return [];
  }
};

test('destinations service reads province lists from local region tables without backend calls', async () => {
  const calls = [];
  const destinations = createDestinationsService(createFailingApi(calls));

  await destinations.getProvinces();

  assert.equal(calls.length, 0);
});

test('destinations service falls back when backend returns an empty province list', async () => {
  const destinations = createDestinationsService(successfulEmptyApi);

  const provinces = await destinations.getProvinces();

  assert.equal(provinces.some((item) => item.code === '510000' && item.name === '四川省'), true);
});

const throwingApi = {
  async get() {
    throw new Error('backend unavailable');
  }
};

test('destinations service falls back to local provinces when backend is unavailable', async () => {
  const destinations = createDestinationsService(throwingApi);

  const provinces = await destinations.getProvinces();

  assert.equal(provinces.some((item) => item.code === '510000' && item.name === '四川省'), true);
});

test('destinations service falls back to local cities and districts', async () => {
  const destinations = createDestinationsService(throwingApi);

  const cities = await destinations.getCities('510000');
  const districts = await destinations.getDistricts('510100');

  assert.equal(cities.some((item) => item.code === '510100' && item.name === '成都市'), true);
  assert.equal(districts.some((item) => item.code === '510104' && item.name === '锦江区'), true);
});
