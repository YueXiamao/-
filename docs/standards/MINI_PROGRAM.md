# 微信小程序开发规范

**版本：** v1.0
**日期：** 2026-04-21

---

## 一、项目初始化

### 1.1 开发工具

- 微信开发者工具（最新稳定版）
- AppID：需在[微信公众平台](https://mp.weixinadmin.com)注册

### 1.2 项目结构

```
frontend/
├── app.js                      # 应用入口
├── app.json                    # 全局配置
├── app.wxss                    # 全局样式
├── pages/                      # 页面
│   └── [page-name]/
│       ├── index.js
│       ├── index.wxml
│       ├── index.wxss
│       └── index.json
├── components/                 # 公共组件
│   └── [component-name]/
│       ├── index.js
│       ├── index.wxml
│       ├── index.wxss
│       └── index.json
├── services/                   # API 请求层
├── utils/                      # 工具函数
├── constants/                  # 常量
└── assets/                     # 静态资源
```

### 1.3 app.json 页面注册

```json
{
  "pages": [
    "pages/index/index",
    "pages/plan/destination/destination",
    "pages/plan/params/params",
    "pages/plan/result/result",
    "pages/discover/input/input",
    "pages/discover/result/result",
    "pages/profile/profile"
  ],
  "window": {
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "旅行规划",
    "backgroundColor": "#f5f5f5"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#07C160",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/profile/profile", "text": "我的" }
    ]
  },
  "permission": {
    "scope.userLocation": {
      "desc": "你的位置信息将用于随机玩功能的目的地推荐"
    }
  }
}
```

---

## 二、代码规范

### 2.1 命名规范

| 类型 | 命名方式 | 示例 |
|---|---|---|
| 页面文件 | kebab-case | `destination.js` |
| 组件文件 | kebab-case | `trip-card.js` |
| JS 变量/函数 | camelCase | `getTripList()` |
| 常量 | UPPER_SNAKE | `MAX_DAYS = 14` |
| WXML 类名 | BEM-ish | `trip-card__title` |
| 页面路径 | kebab-case | `pages/plan/destination/` |

### 2.2 页面结构

每个页面必须有 4 个文件：

```
page-name/
├── index.js      # 逻辑
├── index.wxml    # 结构
├── index.wxss    # 样式
└── index.json    # 页面配置（可有可无，有就覆盖全局）
```

**index.js 最小结构：**

```javascript
// pages/plan/destination/index.js
Page({
  data: {
    // 页面状态
  },

  onLoad(options) {
    // 页面加载
  },

  // 方法列表
  methods: {
    // ...
  }
})
```

### 2.3 组件结构

**index.js：**

```javascript
Component({
  properties: {
    // 从父组件接收的数据
    title: { type: String, value: '' },
    items: { type: Array, value: [] }
  },

  data: {
    // 组件内部状态
  },

  methods: {
    // 组件方法
  }
})
```

---

## 三、API 请求封装

### 3.1 请求基础封装

`services/api.js`：

```javascript
// services/api.js
const BASE_URL = 'https://api.travel.com'; // 生产
// const BASE_URL = 'https://test-api.travel.com'; // 测试

/**
 * 统一请求方法
 * @param {string} path - 接口路径
 * @param {object} data - 请求参数
 * @param {string} method - 请求方法 GET|POST|PATCH|DELETE
 */
function request(path, data = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    // 获取 OpenID（假设存储在 storage）
    const openid = wx.getStorageSync('openid');

    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'X-OpenID': openid || ''
      },
      success(res) {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data);
        } else {
          wx.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(res.data);
        }
      },
      fail(err) {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      }
    });
  });
}

module.exports = {
  request,
  get: (path, data) => request(path, data, 'GET'),
  post: (path, data) => request(path, data, 'POST'),
  patch: (path, data) => request(path, data, 'PATCH'),
  delete: (path, data) => request(path, data, 'DELETE')
};
```

### 3.2 接口调用示例

`services/trip.js`：

```javascript
// services/trip.js
const api = require('./api');

module.exports = {
  generateTrip(params) {
    return api.post('/api/trip/generate', params);
  },

  getTripList(params) {
    return api.get('/api/trip/list', params);
  },

  getTripDetail(tripId) {
    return api.get(`/api/trip/${tripId}`);
  },

  updateTripItem(tripId, itemId, data) {
    return api.patch(`/api/trip/${tripId}/item/${itemId}`, data);
  },

  deleteTrip(tripId) {
    return api.delete(`/api/trip/${tripId}`);
  },

  exportTrip(tripId) {
    return api.get(`/api/trip/${tripId}/export`);
  }
};
```

---

## 四、自定义组件

### 4.1 region-picker（行政区划选择器）

**功能：** 三级联动（省→市→区县）

**接口：**
```javascript
// 组件属性
properties: {
  value: { type: Object, value: {} },  // { province, city, district }
  // 示例: { province: {code, name}, city: {code, name}, district: {code, name} }
}
```

**对外事件：**
```javascript
// 组件方法
this.triggerEvent('change', { province, city, district });
```

**使用示例：**
```xml
<region-picker value="{{selected}}" bind:change="onRegionChange" />
```

### 4.2 tag-selector（标签选择器）

**功能：** 多选标签组，支持单选/多选模式

**接口：**
```javascript
properties: {
  tags: { type: Array, value: [] },           // 标签列表
  selected: { type: Array, value: [] },       // 已选中的标签
  multiple: { type: Boolean, value: true },  // 是否多选
  max: { type: Number, value: 10 }            // 最多选几个
}
```

### 4.3 trip-card（行程卡片）

**功能：** 展示完整行程，支持折叠/展开

### 4.4 day-schedule（每日行程）

**功能：** 单日行程时间线，包含景点/餐饮/住宿

### 4.5 poi-item（POI 单项）

**功能：** 单个 POI 的展示（图片、名称、标签、评分）

### 4.6 loading-skeleton（骨架屏）

**功能：** 加载占位，提升感知性能

---

## 五、页面间数据传递

### 5.1 URL Query 参数（简单数据）

```javascript
// 跳转到结果页
wx.navigateTo({
  url: '/pages/plan/result/result?destinations=成都市,都江堰市&days=3'
});
```

### 5.2 Storage（中等复杂度）

```javascript
// 上一页：存
wx.setStorageSync('trip_params', {
  destinations: [...],
  days: 3,
  start_date: '2026-05-01',
  preferences: ['轻松度假']
});

// 下一页：取
const params = wx.getStorageSync('trip_params');
```

### 5.3 事件总线（跨页面状态同步）

```javascript
// utils/eventBus.js
const events = {};
module.exports = {
  on(key, callback) { (events[key] || (events[key] = [])).push(callback); },
  off(key, callback) {
    if (!callback) { delete events[key]; }
    else { events[key] = (events[key] || []).filter(cb => cb !== callback); }
  },
  emit(key, data) { (events[key] || []).forEach(cb => cb(data)); }
};
```

---

## 六、全局样式

`app.wxss` 定义全局 Token：

```css
/* app.wxss */
page {
  /* 主题色 */
  --color-primary: #07C160;     /* 薄荷绿 */
  --color-secondary: #FFC107;   /* 珊瑚橙 */
  --color-bg: #f5f5f5;
  --color-surface: #ffffff;
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-border: #e5e5e5;

  /* 字体大小 */
  --font-xs: 24rpx;
  --font-sm: 26rpx;
  --font-base: 28rpx;
  --font-lg: 32rpx;
  --font-xl: 36rpx;
  --font-xxl: 44rpx;

  /* 间距 */
  --space-xs: 8rpx;
  --space-sm: 16rpx;
  --space-base: 24rpx;
  --space-lg: 32rpx;
  --space-xl: 48rpx;

  /* 圆角 */
  --radius-sm: 8rpx;
  --radius-base: 16rpx;
  --radius-lg: 24rpx;
  --radius-full: 9999rpx;

  /* 阴影 */
  --shadow-sm: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  --shadow-base: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
}
```

---

## 七、用户体验要点

### 7.1 加载状态

- **页面级加载：** 使用 `loading-skeleton` 骨架屏，不使用纯 spinner
- **操作反馈：** 按钮点击后立即禁用，防止重复提交
- **AI 生成中：** 展示进度状态，如「正在规划第 2/3 天的行程...」

### 7.2 错误处理

- **网络错误：** 断路器展示，提供重试按钮
- **AI 生成失败：** 展示友好提示，自动展示兜底模板
- **空结果：** 展示引导页（「该地区暂无数据，试试选择附近目的地」）

### 7.3 表单交互

- **日期选择：** 使用 `picker` mode="date"，限制范围
- **多选标签：** 选中态明显，提供数量限制提示
- **必填校验：** 提交前检查，错误时滚动到第一个错误项

### 7.4 分享能力

在 `Page` 中添加 `onShareAppMessage`：

```javascript
onShareAppMessage(res) {
  if (res.from === 'button') {
    // 来自页面内转发按钮
  }
  return {
    title: '我的成都3日游行程',
    path: '/pages/plan/result/result?trip_id=xxx'
  };
}
```

---

## 八、Git 协作规范

### 8.1 分支命名

| 分支 | 命名 | 说明 |
|---|---|---|
| 主分支 | `main` | 生产代码 |
| 开发分支 | `develop` | 集成分支 |
| 功能分支 | `feature/trip-generate` | 功能开发 |
| 修复分支 | `fix/poi-list-empty` | Bug 修复 |

### 8.2 Commit 信息

```
<type>(<scope>): <subject>

feat(plan): add destination picker component
fix(trip): handle empty POI result gracefully
docs(api): update trip generate request format
style(profile): adjust tag selector layout
refactor(ai): extract prompt templates to separate file
```

### 8.3 代码审查

- 所有 PR 必须有至少 1 人 review
- review 通过后才能合并到 develop
- 合并到 main 需要 Tech Lead 确认

---

## 九、调试与发布

### 9.1 本地调试

```bash
# 在微信开发者工具中：
# 1. 导入项目，选择 frontend/ 目录
# 2. 填写 AppID
# 3. 勾选"不校验合法域名"（开发阶段）
```

### 9.2 合法域名配置

在微信公众平台后台 → 开发管理 → 服务器域名：

| 域名 | 用途 |
|---|---|
| `api.travel.com` | 后端 API（需 HTTPS） |
| `restapi.amap.com` | 高德地图 API |

### 9.3 发布流程

```
develop 分支合并到 main
    │
    ▼
微信开发者工具 → 上传
    │
    ▼
微信公众平台 → 版本管理 → 提交审核
    │
    ▼
等待微信审核（通常 1-7 天）
    │
    ▼
审核通过后 → 全量发布
```
