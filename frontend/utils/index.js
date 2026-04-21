// 工具函数

// 格式化日期
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${month}.${day} ${weekDay}`;
}

// 复制到剪贴板
export function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
        resolve();
      },
      fail: reject
    });
  });
}

// 防抖
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流
export function throttle(fn, delay = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last > delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// 校验日期（不能早于今天）
export function isValidDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

// 计算行程结束日期
export function calcEndDate(startDate, days) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().split('T')[0];
}
