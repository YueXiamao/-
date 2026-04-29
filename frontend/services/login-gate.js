import { authApi } from './auth.js';

function showModalAsync(wxApi, options) {
  return new Promise((resolve, reject) => {
    wxApi.showModal({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

export function createLoginGate(authService = authApi, wxApi = globalThis.wx) {
  return {
    async ensureAuthorized(options = {}) {
      const cachedOpenid = wxApi?.getStorageSync?.('openid');
      if (cachedOpenid) {
        return {
          authorized: true,
          openid: cachedOpenid,
          prompted: false,
          cancelled: false
        };
      }

      const modalResult = await showModalAsync(wxApi, {
        title: options.title || '登录后继续',
        content: options.content || '需要先完成登录，才能继续当前操作。',
        confirmText: options.confirmText || '立即登录',
        cancelText: options.cancelText || '暂不登录'
      });

      if (!modalResult?.confirm) {
        return {
          authorized: false,
          openid: '',
          prompted: true,
          cancelled: true
        };
      }

      const data = await authService.ensureLogin();
      return {
        authorized: Boolean(data?.openid),
        openid: data?.openid || '',
        prompted: true,
        cancelled: false
      };
    }
  };
}

export const loginGate = createLoginGate();

export default loginGate;
