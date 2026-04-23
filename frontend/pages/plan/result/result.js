// pages/plan/result/result.js
import { formatDate } from '../../../utils/index.js';
import { copyToClipboard } from '../../../utils/index.js';
import tripApi from '../../../services/trip.js';

Page({
  data: {
    // 行程数据
    trip: null,
    tripId: null,

    // UI 状态
    loading: true,
    generatingText: '正在规划行程...',
    currentDay: -1, // -1 表示全部折叠
    expandedItems: {}, // 展开的 items

    // 错误状态
    error: null,
    useFallback: false
  },

  onLoad() {
    const params = wx.getStorageSync('trip_params');
    if (!params) {
      wx.navigateBack();
      return;
    }
    this.generateTrip(params);
  },

  // 调用后端生成行程
  async generateTrip(params) {
    this.setData({ loading: true, error: null });

    try {
      // 更新生成状态文本
      this.setData({ generatingText: '正在搜索景点...' });
      await new Promise(r => setTimeout(r, 500));

      this.setData({ generatingText: '正在规划每日行程...' });
      const trip = await tripApi.generate(params);

      this.setData({
        trip,
        tripId: trip.trip_id,
        loading: false
      });
    } catch (err) {
      console.error('行程生成失败', err);
      this.setData({
        loading: false,
        error: '行程生成失败，请稍后重试',
        generatingText: ''
      });
    }
  },

  // 重试
  onRetry() {
    const params = wx.getStorageSync('trip_params');
    if (params) this.generateTrip(params);
  },

  // 展开/收起天
  onDayTap(e) {
    const { index } = e.currentTarget.dataset;
    // -1 = 全部折叠；点击已展开的收起来，点击折叠的展开
    this.setData({ currentDay: this.data.currentDay === index ? -1 : index });
  },

  // 展开/收起单项
  onItemTap(e) {
    const { index } = e.currentTarget.dataset;
    const key = `expandedItems[${index}]`;
    this.setData({ [key]: !this.data.expandedItems[index] });
  },

  // 删除单项
  onItemDelete(e) {
    const { index } = e.currentTarget.dataset;
    const { trip } = this.data;
    const dayIndex = this.data.currentDay;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这一项吗？',
      success: (res) => {
        if (res.confirm) {
          trip.itinerary[dayIndex].items.splice(index, 1);
          this.setData({ trip });
        }
      }
    });
  },

  // 添加备注
  onAddNote(e) {
    const { index } = e.currentTarget.dataset;
    const { trip } = this.data;
    const dayIndex = this.data.currentDay;

    wx.showModal({
      title: '添加备注',
      editable: true,
      placeholderText: '输入备注...',
      success: (res) => {
        if (res.confirm && res.content) {
          if (!trip.itinerary[dayIndex].items[index].notes) {
            trip.itinerary[dayIndex].items[index].notes = [];
          }
          trip.itinerary[dayIndex].items[index].notes = res.content;
          this.setData({ trip });
        }
      }
    });
  },

  // 保存行程
  async onSave() {
    if (!this.data.trip) return;

    try {
      wx.showLoading({ title: '保存中...' });
      await tripApi.save(this.data.trip);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 复制行程
  async onCopy() {
    const { trip } = this.data;
    if (!trip) return;

    let text = `${trip.title || '旅行行程'}\n`;
    text += `${trip.start_date} · ${trip.days}天\n`;
    text += `${(trip.preferences || []).join(' / ')}\n\n`;

    for (const day of trip.itinerary || []) {
      text += `=== DAY ${day.day} ===\n`;
      for (const item of day.items || []) {
        if (item.type === 'spot') {
          text += `[P] ${item.name}\n   ${item.address || ''} ${item.duration ? '· ' + item.duration : ''}\n`;
          if (item.description) text += `   ${item.description}\n`;
          if (item.transport_to_next) text += `   -> ${item.transport_to_next}\n`;
        } else if (item.type === 'food') {
          text += `[F] ${item.name}\n   ${item.address || ''}\n   ${item.recommend || ''} ${item.budget ? '· ' + item.budget : ''}\n`;
        } else if (item.type === 'hotel') {
          text += `[H] ${item.name}\n   ${item.address || ''}\n   ${item.budget || ''}\n`;
        }
        if (item.notes) text += `   note: ${item.notes}\n`;
      }
      text += '\n';
    }

    await copyToClipboard(text);
  },

  // 分享
  onShareAppMessage() {
    const { trip } = this.data;
    return {
      title: trip?.title || '我的旅行行程',
      path: `/pages/plan/result/result?trip_id=${this.data.tripId}`
    };
  },

  // 格式化日期显示
  formatDayDate(dateStr) {
    return formatDate(dateStr);
  }
});
