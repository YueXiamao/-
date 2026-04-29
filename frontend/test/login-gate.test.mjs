import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoginGate } from '../services/login-gate.js';

test('login gate reuses cached openid without showing modal', async () => {
  let modalCalled = false;
  const gate = createLoginGate({
    async ensureLogin() {
      throw new Error('should not login when openid exists');
    }
  }, {
    getStorageSync(key) {
      return key === 'openid' ? 'openid-cached' : '';
    },
    showModal() {
      modalCalled = true;
    }
  });

  const result = await gate.ensureAuthorized();

  assert.equal(result.authorized, true);
  assert.equal(result.openid, 'openid-cached');
  assert.equal(result.prompted, false);
  assert.equal(modalCalled, false);
});

test('login gate stops when user cancels modal', async () => {
  const gate = createLoginGate({
    async ensureLogin() {
      throw new Error('should not login after cancel');
    }
  }, {
    getStorageSync() {
      return '';
    },
    showModal({ success }) {
      success({ confirm: false, cancel: true });
    }
  });

  const result = await gate.ensureAuthorized({
    title: '登录后继续'
  });

  assert.equal(result.authorized, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.prompted, true);
});

test('login gate runs ensureLogin after user confirms', async () => {
  let loginCalled = false;
  const gate = createLoginGate({
    async ensureLogin() {
      loginCalled = true;
      return { openid: 'openid-new' };
    }
  }, {
    getStorageSync() {
      return '';
    },
    showModal({ success, title, confirmText }) {
      assert.equal(title, '登录后继续');
      assert.equal(confirmText, '立即登录');
      success({ confirm: true, cancel: false });
    }
  });

  const result = await gate.ensureAuthorized({
    title: '登录后继续',
    confirmText: '立即登录'
  });

  assert.equal(loginCalled, true);
  assert.equal(result.authorized, true);
  assert.equal(result.openid, 'openid-new');
  assert.equal(result.prompted, true);
});
