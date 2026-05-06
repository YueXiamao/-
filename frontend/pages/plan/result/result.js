import { formatDate, copyToClipboard } from '../../../utils/index.js';
import tripApi from '../../../services/trip.js';
import { getCityBackground } from '../../../constants/index.js';
import { normalizeGenerationState } from './generation-state.js';
import { consumeTripResultEntry, createRetryParamsStore } from './entry-state.js';
import { getGenerationErrorMessage } from '../../../services/backend-health.js';
import { track, EVENT_TYPES } from '../../../services/analytics.js';

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
    pageBackground: getCityBackground(),
    draggingItem: null,
    dragOverItem: null,
    replaceIntents: [
      { label: '换近一点', intent: 'nearer' },
      { label: '换便宜', intent: 'cheaper' },
      { label: '换室内', intent: 'indoor' },
      { label: '换亲子', intent: 'family' },
      { label: '随便换一个', intent: 'any' },
    ],
  },

  onLoad(options = {}) {
    this._retryParamsStore = createRetryParamsStore();
    const entry = consumeTripResultEntry({
      options,
      getStorageSync: (key) => wx.getStorageSync(key),
      removeStorageSync: (key) => wx.removeStorageSync(key)
    });

    if (entry.mode === 'detail') {
      this.loadTripDetail(entry.tripId);
      return;
    }

    if (entry.mode === 'generated') {
      this.setTripState(entry.trip, entry.trip?.trip_id);
      return;
    }

    if (entry.mode === 'generate') {
      this._retryParamsStore.set(entry.params);
      this.generateTrip(entry.params);
      return;
    }

    wx.navigateBack();
  },

  setTripState(trip, tripId = null) {
    const generationState = normalizeGenerationState(trip);

    // Build stable itemKey for wx:key (index-based, always unique within day)
    if (trip?.itinerary) {
      trip.itinerary = trip.itinerary.map((day, di) => ({
        ...day,
        items: (day.items || []).map((item, ii) => ({
          ...item,
          itemKey: `${di}-${ii}`
        }))
      }));
    }

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
    let enhancingTimer = null;
    try {
      await tripApi.health();
      this.setData({
        step: 'building_skeleton',
        generatingText: '正在安排每日节奏...'
      });
      enhancingTimer = setTimeout(() => {
        if (!this.data.loading) return;
        this.setData({
          step: 'enhancing',
          generatingText: '正在补充推荐内容...'
        });
      }, 1200);
      const trip = await tripApi.generate(params);
      this._retryParamsStore?.clear();
      clearTimeout(enhancingTimer);
      this.setTripState(trip, trip.trip_id);
      track(EVENT_TYPES.TRIP_GENERATE_SUCCESS, {
        targetType: 'trip', targetId: trip.trip_id,
        payload: { days: params.days, destinations: params.destinations }
      });
    } catch (error) {
      if (enhancingTimer) clearTimeout(enhancingTimer);
      console.error('Failed to generate trip:', error);
      this.setData({
        loading: false,
        phase: 'error',
        error: getGenerationErrorMessage(error),
        generatingText: ''
      });
      track(EVENT_TYPES.TRIP_GENERATE_FAILED, {
        payload: { error: error?.message || String(error), params }
      });
    }
  },

  onRetry() {
    const retryParams = this._retryParamsStore?.get();

    if (this.data.tripId && !retryParams) {
      this.loadTripDetail(this.data.tripId);
      return;
    }

    if (retryParams) {
      this.generateTrip(retryParams);
    }
  },

  onDayTap(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      currentDay: this.data.currentDay === index ? -1 : index
    });
  },

  // ---------- Touch-based drag reorder ----------
  _itemHeights: [],

  onDragStart(e) {
    const { dayIndex, itemIndex } = e.currentTarget.dataset;
    this._itemHeights = [];
    this.setData({
      draggingItem: { dayIndex: Number(dayIndex), itemIndex: Number(itemIndex) },
      dragOverItem: null
    });
  },

  onDragMove(e) {
    if (!this.data.draggingItem) return;

    const { dayIndex, itemIndex } = e.currentTarget.dataset;
    // Only show drag-over indicator for items in the same day
    if (Number(dayIndex) !== this.data.draggingItem.dayIndex) {
      this.setData({ dragOverItem: null });
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    // Use pageY to determine which item we're hovering over
    const pageY = touch.pageY;
    const day = this.data.trip?.itinerary?.[dayIndex];
    if (!day || !day.items) return;

    // Find which item the touch is currently over
    // We track item top positions using the itemHeights array
    let overIndex = itemIndex;

    // If we have tracked heights, use them
    if (this._itemHeights.length === day.items.length) {
      for (let i = 0; i < this._itemHeights.length; i++) {
        if (pageY < this._itemHeights[i]) {
          overIndex = i;
          break;
        }
        overIndex = i;
      }
    }

    const currentOver = this.data.dragOverItem;
    if (!currentOver || currentOver.dayIndex !== dayIndex || currentOver.itemIndex !== overIndex) {
      this.setData({
        dragOverItem: { dayIndex: Number(dayIndex), itemIndex: overIndex }
      });
    }
  },

  onDragEnd(e) {
    if (!this.data.draggingItem) return;

    const { dayIndex, itemIndex } = e.currentTarget.dataset;
    const fromDayIndex = this.data.draggingItem.dayIndex;
    const fromItemIndex = this.data.draggingItem.itemIndex;
    const toItemIndex = this.data.dragOverItem
      ? this.data.dragOverItem.itemIndex
      : Number(itemIndex);

    this.setData({ draggingItem: null, dragOverItem: null });
    this._itemHeights = [];

    if (fromDayIndex !== Number(dayIndex)) return;
    if (fromItemIndex === toItemIndex) return;

    const day = this.data.trip?.itinerary?.[fromDayIndex];
    if (!day) return;

    const nextItems = [...day.items];
    const [movedItem] = nextItems.splice(fromItemIndex, 1);
    nextItems.splice(toItemIndex, 0, movedItem);

    // Reassign itemKey after reorder to keep wx:key stable
    nextItems.forEach((item, idx) => {
      item.itemKey = `${fromDayIndex}-${idx}`;
    });

    this.updateDayItems(fromDayIndex, nextItems);

    if (movedItem.id && this.data.tripId) {
      const direction = toItemIndex > fromItemIndex ? 'down' : 'up';
      tripApi.reorderItem(this.data.tripId, movedItem.id, direction).catch(() => {});
    }
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

      // Keep itemKey stable
      nextItems.forEach((item, idx) => {
        item.itemKey = `${dayIndex}-${idx}`;
      });

      this.updateDayItems(dayIndex, nextItems);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '排序失败，请稍后重试', icon: 'none' });
    }
  },

  async onIntentReplace(e) {
    const { intent } = this.data.replaceIntents[e.detail.value];
    const context = this.getItemContext(e.currentTarget.dataset);
    if (!context) return;

    const { item, itemIndex, dayIndex, day } = context;
    if (!item.id || !this.data.tripId) {
      wx.showToast({ title: '请先保存行程后再替换', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '正在更换...' });
      const result = await tripApi.replaceItem(this.data.tripId, item.id, { intent });
      wx.hideLoading();

      const nextItems = [...day.items];
      nextItems[itemIndex] = { ...nextItems[itemIndex], ...(result?.item || {}) };
      this.updateDayItems(dayIndex, nextItems);
      wx.showToast({ title: intent === 'any' ? '已换一个' : `已换${intent === 'nearer' ? '近一点' : intent === 'cheaper' ? '便宜的' : intent === 'indoor' ? '室内的' : intent === 'family' ? '亲子的' : '一个'}`, icon: 'success' });
      track(EVENT_TYPES.TRIP_ITEM_REPLACE, {
        targetType: 'trip_item', targetId: item.id,
        payload: { tripId: this.data.tripId, itemType: item.type, intent }
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '暂时没有更合适的替换项', icon: 'none' });
    }
  },

  async onItemReplace(e) {
    // Legacy: generic replace without intent
    const fakeEvent = {
      ...e,
      currentTarget: {
        ...e.currentTarget,
        dataset: { ...e.currentTarget.dataset }
      }
    };
    fakeEvent.currentTarget.dataset.intent = 'any';
    // Delegate to onIntentReplace with 'any' intent
    const { dayIndex, itemIndex } = fakeEvent.currentTarget.dataset;
    const context = this.getItemContext(fakeEvent.currentTarget.dataset);
    if (!context) return;

    const { item, day } = context;
    if (!item.id || !this.data.tripId) {
      wx.showToast({ title: '请先保存行程后再替换', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '正在替换...' });
      const result = await tripApi.replaceItem(this.data.tripId, item.id);
      wx.hideLoading();

      const nextItems = [...day.items];
      nextItems[itemIndex] = { ...nextItems[itemIndex], ...(result?.item || {}) };
      this.updateDayItems(dayIndex, nextItems);
      wx.showToast({ title: '已换一个', icon: 'success' });
      track(EVENT_TYPES.TRIP_ITEM_REPLACE, {
        targetType: 'trip_item', targetId: item.id, payload: { tripId: this.data.tripId, itemType: item.type }
      });
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
          nextItems.forEach((item, idx) => {
            item.itemKey = `${dayIndex}-${idx}`;
          });
          this.updateDayItems(dayIndex, nextItems);
          track(EVENT_TYPES.TRIP_ITEM_DELETE, {
            targetType: 'trip_item', targetId: item.id, payload: { tripId: this.data.tripId, itemType: item.type }
          });
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

  async onReferenceLinkTap(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) return;

    await copyToClipboard(url);
    wx.showToast({ title: '链接已复制', icon: 'success' });
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
      track(EVENT_TYPES.TRIP_SAVE, { targetType: 'trip', targetId: saved.trip_id });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async onFeedback() {
    if (!this.data.trip) return;
    wx.showActionSheet({
      itemList: ['不准', '太赶', '预算不符', '景点不喜欢', '其他'],
      success: async (res) => {
        const feedbackMap = {
          0: '不准',
          1: '太赶',
          2: '预算不符',
          3: '景点不喜欢',
          4: '其他'
        };
        const feedback = feedbackMap[res.tapIndex];
        try {
          await tripApi.feedback(this.data.tripId || this.data.trip?.trip_id, { type: feedback });
          wx.showToast({ title: '感谢反馈', icon: 'success' });
        } catch {
          wx.showToast({ title: '反馈失败，请稍后', icon: 'none' });
        }
      }
    });
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

        if (item.reference_links?.length) {
          text += `   参考：${item.reference_links.map((link) => link.url).join(' | ')}\n`;
        }

        if (item.notes) text += `   note: ${item.notes}\n`;
      }

      if (day.alternative_spots?.length) {
        text += `   备选景点：${day.alternative_spots.map((item) => item.name).join(' / ')}\n`;
      }
      if (day.alternative_foods?.length) {
        text += `   备选美食：${day.alternative_foods.map((item) => item.name).join(' / ')}\n`;
      }
      text += '\n';
    }

    await copyToClipboard(text);
    track(EVENT_TYPES.TRIP_COPY, { targetType: 'trip', targetId: this.data.tripId || '' });
  },

  onShareAppMessage() {
    const { trip } = this.data;
    const hasSavedTrip = /^\d+$/.test(String(this.data.tripId || ''));
    track(EVENT_TYPES.TRIP_SHARE, { targetType: 'trip', targetId: this.data.tripId || '' });
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
