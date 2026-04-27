import { formatDate, copyToClipboard } from '../../../utils/index.js';
import tripApi from '../../../services/trip.js';
import { getCityBackground } from '../../../constants/index.js';
import { normalizeGenerationState } from './generation-state.js';

Page({
  data: {
    trip: null,
    tripId: null,
    phase: 'idle',
    step: 'validating',
    fallbackLevel: 'none',
    bannerLabel: '',
    bannerText: '',
    loading: true,
    generatingText: '正在规划行程...',
    currentDay: -1,
    error: null,
    pageBackground: getCityBackground()
  },

  onLoad(options = {}) {
    if (options.trip_id) {
      this.loadTripDetail(options.trip_id);
      return;
    }

    const generatedTrip = wx.getStorageSync('pre_generated_trip');
    if (generatedTrip) {
      wx.removeStorageSync('pre_generated_trip');
      this.setTripState(generatedTrip, generatedTrip.trip_id);
      return;
    }

    const params = wx.getStorageSync('trip_params');
    if (!params) {
      wx.navigateBack();
      return;
    }

    this.generateTrip(params);
  },

  setTripState(trip, tripId = null) {
    const generationState = normalizeGenerationState(trip);

    this.setData({
      trip,
      tripId: tripId || trip?.trip_id || this.data.tripId,
      loading: false,
      error: null,
      currentDay: trip?.itinerary?.length ? 0 : -1,
      pageBackground: getCityBackground(trip?.destinations),
      phase: generationState.phase,
      fallbackLevel: generationState.fallbackLevel,
      bannerLabel: generationState.bannerLabel,
      bannerText: generationState.bannerText
    });
  },

  async loadTripDetail(tripId) {
    this.setData({
      loading: true,
      error: null,
      phase: 'loading',
      step: 'loading_detail',
      bannerLabel: '',
      bannerText: '',
      generatingText: '正在加载行程...'
    });

    try {
      const trip = await tripApi.detail(tripId);
      this.setTripState(trip, tripId);
    } catch (error) {
      console.error('Failed to load trip detail:', error);
      this.setData({
        loading: false,
        phase: 'error',
        error: '行程加载失败，请稍后重试',
        generatingText: ''
      });
    }
  },

  async generateTrip(params) {
    this.setData({
      loading: true,
      error: null,
      phase: 'generating',
      step: 'fetching_pois',
      bannerLabel: '',
      bannerText: '',
      generatingText: '正在搜索景点与餐饮...'
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.setData({
        step: 'building_skeleton',
        generatingText: '正在安排每日节奏...'
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.setData({
        step: 'enhancing',
        generatingText: '正在补充推荐内容...'
      });
      const trip = await tripApi.generate(params);
      this.setTripState(trip, trip.trip_id);
    } catch (error) {
      console.error('Failed to generate trip:', error);
      this.setData({
        loading: false,
        phase: 'error',
        error: error?.retryable ? '生成遇到临时问题，可以再试一次' : '行程生成失败，请稍后重试',
        generatingText: ''
      });
    }
  },

  onRetry() {
    if (this.data.tripId && !wx.getStorageSync('trip_params')) {
      this.loadTripDetail(this.data.tripId);
      return;
    }

    const params = wx.getStorageSync('trip_params');
    if (params) {
      this.generateTrip(params);
    }
  },

  onDayTap(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      currentDay: this.data.currentDay === index ? -1 : index
    });
  },

  getItemContext(dataset) {
    const dayIndex = Number(dataset.dayIndex);
    const itemIndex = Number(dataset.itemIndex);
    const trip = this.data.trip;
    const day = trip?.itinerary?.[dayIndex];
    const item = day?.items?.[itemIndex];

    if (!trip || !day || !item) return null;
    return { trip, dayIndex, itemIndex, day, item };
  },

  updateDayItems(dayIndex, items) {
    const trip = this.data.trip;
    if (!trip?.itinerary?.[dayIndex]) return;

    const nextTrip = {
      ...trip,
      itinerary: trip.itinerary.map((day, index) => (
        index === dayIndex ? { ...day, items } : day
      ))
    };

    this.setData({ trip: nextTrip });
  },

  async onItemMove(e) {
    const { direction } = e.currentTarget.dataset;
    const context = this.getItemContext(e.currentTarget.dataset);
    if (!context) return;

    const { item, itemIndex, dayIndex, day } = context;
    const swapIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;

    if (swapIndex < 0) {
      wx.showToast({ title: '已经在最前了', icon: 'none' });
      return;
    }

    if (swapIndex >= day.items.length) {
      wx.showToast({ title: '已经在最后了', icon: 'none' });
      return;
    }

    try {
      if (item.id && this.data.tripId) {
        wx.showLoading({ title: direction === 'up' ? '上移中...' : '下移中...' });
        await tripApi.reorderItem(this.data.tripId, item.id, direction);
        wx.hideLoading();
      }

      const nextItems = [...day.items];
      [nextItems[itemIndex], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[itemIndex]];
      this.updateDayItems(dayIndex, nextItems);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '排序失败，请稍后重试', icon: 'none' });
    }
  },

  async onItemReplace(e) {
    const context = this.getItemContext(e.currentTarget.dataset);
    if (!context) return;

    const { item, itemIndex, dayIndex, day } = context;
    if (!item.id || !this.data.tripId) {
      wx.showToast({ title: '请先保存行程后再替换', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '正在替换...' });
      const result = await tripApi.replaceItem(this.data.tripId, item.id);
      wx.hideLoading();

      const nextItems = [...day.items];
      nextItems[itemIndex] = {
        ...nextItems[itemIndex],
        ...(result?.item || {})
      };
      this.updateDayItems(dayIndex, nextItems);
      wx.showToast({ title: '已换一个', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '暂时没有更合适的替换项', icon: 'none' });
    }
  },

  async onItemDelete(e) {
    const context = this.getItemContext(e.currentTarget.dataset);
    if (!context) return;

    const { item, itemIndex, dayIndex, day } = context;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这一项吗？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          if (item.id && this.data.tripId) {
            wx.showLoading({ title: '删除中...' });
            await tripApi.deleteItem(this.data.tripId, item.id);
            wx.hideLoading();
          }

          const nextItems = day.items.filter((_, index) => index !== itemIndex);
          this.updateDayItems(dayIndex, nextItems);
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  onAddNote(e) {
    const context = this.getItemContext(e.currentTarget.dataset);
    if (!context) return;

    const { item, itemIndex, dayIndex, day } = context;
    wx.showModal({
      title: '添加备注',
      editable: true,
      placeholderText: '输入备注...',
      success: async (res) => {
        if (!res.confirm || !res.content) return;

        try {
          if (item.id && this.data.tripId) {
            wx.showLoading({ title: '保存备注...' });
            await tripApi.updateItem(this.data.tripId, item.id, { notes: res.content });
            wx.hideLoading();
          }

          const nextItems = [...day.items];
          nextItems[itemIndex] = {
            ...nextItems[itemIndex],
            notes: res.content
          };
          this.updateDayItems(dayIndex, nextItems);
        } catch (error) {
          wx.hideLoading();
          wx.showToast({ title: '备注保存失败', icon: 'none' });
        }
      }
    });
  },

  async onSave() {
    if (!this.data.trip) return;

    try {
      wx.showLoading({ title: '保存中...' });
      const saved = await tripApi.save(this.data.trip);
      const detail = await tripApi.detail(saved.trip_id);
      wx.hideLoading();
      this.setTripState(detail, saved.trip_id);
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async onCopy() {
    const { trip } = this.data;
    if (!trip) return;

    let text = `${trip.title || '旅行行程'}\n`;
    text += `${trip.start_date} · ${trip.days}天\n`;
    text += `${(trip.preferences || []).join(' / ')}\n\n`;

    for (const day of trip.itinerary || []) {
      text += `=== DAY ${day.day || day.day_number} ===\n`;
      for (const item of day.items || []) {
        if (item.type === 'spot') {
          text += `[P] ${item.name}\n   ${item.address || ''}${item.duration ? ` · ${item.duration}` : ''}\n`;
          if (item.description) text += `   ${item.description}\n`;
          if (item.transport_to_next) text += `   -> ${item.transport_to_next}\n`;
        } else if (item.type === 'food') {
          text += `[F] ${item.name}\n   ${item.address || ''}\n   ${item.recommend || ''}${item.budget ? ` · ${item.budget}` : ''}\n`;
        } else if (item.type === 'hotel') {
          text += `[H] ${item.name}\n   ${item.address || ''}\n   ${item.budget || ''}\n`;
        }

        if (item.notes) text += `   note: ${item.notes}\n`;
      }
      text += '\n';
    }

    await copyToClipboard(text);
  },

  onShareAppMessage() {
    const { trip } = this.data;
    const hasSavedTrip = /^\d+$/.test(String(this.data.tripId || ''));
    return {
      title: trip?.title || '我的旅行行程',
      path: hasSavedTrip
        ? `/pages/plan/result/result?trip_id=${this.data.tripId}`
        : '/pages/index/index'
    };
  },

  formatDayDate(dateStr) {
    return formatDate(dateStr);
  }
});
