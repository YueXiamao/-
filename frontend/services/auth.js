import { api } from './api.js';

function wxLogin(wxApi) {
  return new Promise((resolve, reject) => {
    wxApi.login({
      success: resolve,
      fail: reject
    });
  });
}

export function createAuthService(apiClient = api, wxApi = globalThis.wx) {
  return {
    login(code) {
      return apiClient.post('/api/auth/login', { code });
    },

    async ensureLogin() {
      const existing = wxApi?.getStorageSync?.('openid');
      if (existing) {
        return { openid: existing };
      }

      const { code } = await wxLogin(wxApi);
      if (!code) {
        throw new Error('wx.login failed');
      }

      const data = await this.login(code);
      const openid = data?.openid;
      if (!openid) {
        throw new Error('no openid returned');
      }

      wxApi?.setStorageSync?.('openid', openid);
      return data;
    }
  };
}

export const authApi = createAuthService();

export default authApi;
