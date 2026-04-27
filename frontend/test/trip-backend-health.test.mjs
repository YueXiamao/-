import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKEND_OFFLINE_MESSAGE,
  getGenerationErrorMessage,
  isBackendUnavailableError
} from '../services/backend-health.js';

test('backend unavailable classifier recognizes request connection failures', () => {
  assert.equal(isBackendUnavailableError({ errMsg: 'request:fail connect ECONNREFUSED 127.0.0.1:3000' }), true);
  assert.equal(isBackendUnavailableError({ errMsg: 'request:fail timeout' }), true);
  assert.equal(isBackendUnavailableError({ statusCode: 500 }), false);
});

test('generation error message tells developers when the local backend is not running', () => {
  const message = getGenerationErrorMessage({
    code: 'BACKEND_UNAVAILABLE',
    errMsg: 'request:fail connect ECONNREFUSED 127.0.0.1:3000'
  });

  assert.equal(message, BACKEND_OFFLINE_MESSAGE);
});
