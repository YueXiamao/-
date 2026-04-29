import tripApi from '../../services/trip.js';
import { loginGate } from '../../services/login-gate.js';

Page({
  data: {
    openid: '',
    tripList: [],
    loading: false,
    empty: true,
    loginRequired: false
  },

  onLoad() {
    this.bootstrapProfile();
  },

  onShow() {
    if (this._bootstrapping) return;
    if (!this._hasBootstrapped) return;
    this.refreshTrips();
  },

  async bootstrapProfile() {
    if (this._bootstrappingPromise) return this._bootstrappingPromise;

    this._bootstrapping = true;
    this._bootstrappingPromise = (async () => {
      await this.ensureProfileAccess();
      this._hasBootstrapped = true;
      this._bootstrapping = false;
      this._bootstrappingPromise = null;
    })();

    return this._bootstrappingPromise;
  },

  async refreshTrips() {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      await this.ensureProfileAccess();
      return;
    }

    if (openid !== this.data.openid) {
      this.setData({
        openid,
        loginRequired: false
      });
    }

    await this.loadTrips();
  },

  async ensureProfileAccess() {
    if (this._loginPromise) return this._loginPromise;

    this.setData({ loading: true });
    this._loginPromise = (async () => {
      try {
        const result = await loginGate.ensureAuthorized({
          title: '登录后查看我的行程',
          content: '登录后才能同步你的历史行程、继续编辑之前的安排，也方便后续查看。',
          confirmText: '授权登录',
          cancelText: '先不登录'
        });

        if (!result.authorized) {
          this.setData({
            loginRequired: true,
            openid: '',
            tripList: [],
            empty: true
          });
          return;
        }

        this.setData({
          openid: result.openid,
          loginRequired: false
        });
        await this.loadTrips();
      } catch (error) {
        console.error('登录授权失败', error);
        this.setData({
          loginRequired: true,
          openid: '',
          tripList: [],
          empty: true
        });
      } finally {
        this.setData({ loading: false });
        this._loginPromise = null;
      }
    })();

    return this._loginPromise;
  },

  async loadTrips() {
    if (this._tripPromise) return this._tripPromise;

    this.setData({ loading: true });
    this._tripPromise = (async () => {
      try {
        const result = await tripApi.list({ page: 1, page_size: 20 });
        const tripList = result.list || [];
        this.setData({
          tripList,
          empty: tripList.length === 0
        });
      } catch (error) {
        console.error('加载行程失败', error);
      } finally {
        this.setData({ loading: false });
        this._tripPromise = null;
      }
    })();

    return this._tripPromise;
  },

  onTripTap(e) {
    const { tripId } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/plan/result/result?trip_id=${tripId}` });
  },

  onTripDelete(e) {
    const { tripId } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await tripApi.delete(tripId);
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadTrips();
        } catch (error) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onLoginTap() {
    this.ensureProfileAccess();
  }
});
