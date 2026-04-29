import assert from 'node:assert/strict';
import test from 'node:test';

test('api base url switches to production url in release environment', async () => {
  const { resolveApiBaseUrl } = await import('../services/api.js');

  const baseUrl = resolveApiBaseUrl({
    getAccountInfoSync() {
      return { miniProgram: { envVersion: 'release' } };
    }
  });

  assert.equal(baseUrl, 'https://api.travel.com');
});

test('api base url uses loopback ip in desktop devtools development', async () => {
  const { resolveApiBaseUrl } = await import('../services/api.js');

  const baseUrl = resolveApiBaseUrl({
    getAccountInfoSync() {
      return { miniProgram: { envVersion: 'develop' } };
    },
    getSystemInfoSync() {
      return { platform: 'windows' };
    }
  });

  assert.equal(baseUrl, 'http://127.0.0.1:3000');
});

test('api base url uses LAN ip on mobile development builds', async () => {
  const { resolveApiBaseUrl } = await import('../services/api.js');

  const baseUrl = resolveApiBaseUrl({
    getAccountInfoSync() {
      return { miniProgram: { envVersion: 'develop' } };
    },
    getSystemInfoSync() {
      return { platform: 'android' };
    }
  });

  assert.equal(baseUrl, 'http://192.168.20.141:3000');
});

test('auth ensureLogin reuses stored openid before calling wx.login', async () => {
  const { createAuthService } = await import('../services/auth.js');
  let loginCalled = false;
  const wxApi = {
    getStorageSync(key) {
      return key === 'openid' ? 'openid-stored' : '';
    },
    setStorageSync() {},
    login() {
      loginCalled = true;
    }
  };
  const auth = createAuthService({
    async post() {
      throw new Error('api should not be called when openid exists');
    }
  }, wxApi);

  const result = await auth.ensureLogin();

  assert.equal(result.openid, 'openid-stored');
  assert.equal(loginCalled, false);
});

test('auth ensureLogin stores openid returned by login api', async () => {
  const { createAuthService } = await import('../services/auth.js');
  const stored = {};
  const wxApi = {
    getStorageSync() {
      return '';
    },
    setStorageSync(key, value) {
      stored[key] = value;
    },
    login({ success }) {
      success({ code: 'wx-code' });
    }
  };
  const auth = createAuthService({
    async post(path, payload) {
      assert.equal(path, '/api/auth/login');
      assert.deepEqual(payload, { code: 'wx-code' });
      return { openid: 'openid-new', user_id: 7 };
    }
  }, wxApi);

  const result = await auth.ensureLogin();

  assert.equal(result.openid, 'openid-new');
  assert.equal(stored.openid, 'openid-new');
});

test('discover result page accepts unified response object with recommendations array', async () => {
  globalThis.Page = () => {};
  const { normalizeDiscoverRecommendations } = await import('../pages/discover/result/result.js');

  const recommendations = normalizeDiscoverRecommendations({
    recommendations: [{ rank: 1, destination: { name: '成都' } }]
  });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].destination.name, '成都');
});
