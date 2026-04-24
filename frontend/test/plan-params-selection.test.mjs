import assert from 'node:assert/strict';
import test from 'node:test';
import { PREFERENCE_OPTIONS } from '../constants/index.js';

test('plan params preference tap mirrors selection onto option objects', async () => {
  let pageConfig;
  globalThis.Page = (config) => {
    pageConfig = config;
  };

  await import('../pages/plan/params/params.js');

  const page = {
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(nextData) {
      this.data = { ...this.data, ...nextData };
    }
  };
  const event = {
    currentTarget: {
      dataset: { value: PREFERENCE_OPTIONS[0].value }
    }
  };

  pageConfig.onPreferenceTap.call(page, event);

  assert.equal(page.data.preferences.includes(PREFERENCE_OPTIONS[0].value), true);
  assert.equal(page.data.preferenceOptions[0].selected, true);

  pageConfig.onPreferenceTap.call(page, event);

  assert.equal(page.data.preferences.includes(PREFERENCE_OPTIONS[0].value), false);
  assert.equal(page.data.preferenceOptions[0].selected, false);
});
