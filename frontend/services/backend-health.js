import { api } from './api.js';

export const BACKEND_OFFLINE_MESSAGE = '本地后端服务未启动，请先启动 backend 服务后再重试';

export function isBackendUnavailableError(error = {}) {
  const message = String(error.errMsg || error.message || error.code || '').toLowerCase();
  return error.code === 'BACKEND_UNAVAILABLE'
    || message.includes('econnrefused')
    || message.includes('unable to connect')
    || message.includes('timeout')
    || message.includes('request:fail')
    || message.includes('failed to fetch');
}

export function getGenerationErrorMessage(error = {}) {
  if (isBackendUnavailableError(error)) {
    return BACKEND_OFFLINE_MESSAGE;
  }

  return error?.retryable
    ? '生成遇到临时问题，可以再试一次'
    : '行程生成失败，请稍后重试';
}

export async function ensureBackendHealthy(apiClient = api) {
  try {
    await apiClient.get('/health', undefined, { silent: true });
    return true;
  } catch (error) {
    throw {
      code: 'BACKEND_UNAVAILABLE',
      retryable: true,
      message: BACKEND_OFFLINE_MESSAGE,
      cause: error
    };
  }
}
