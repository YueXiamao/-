# 旅游行程规划小程序 · 开发完全手册

**项目代号：** TravelPlanner
**当前版本：** v1.0.0
**最后更新：** 2026-04-21
**状态：** 需求确认中

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构总览](#2-技术架构总览)
3. [前端小程序架构](#3-前端小程序架构)
4. [后端服务架构](#4-后端服务架构)
5. [数据库设计](#5-数据库设计)
6. [API接口设计](#6-api接口设计)
7. [AI服务设计](#7-ai服务设计)
8. [目录结构规范](#8-目录结构规范)
9. [开发规范](#9-开发规范)
10. [数据管理规范](#10-数据管理规范)
11. [安全规范](#11-安全规范)
12. [部署方案](#12-部署方案)
13. [版本迭代计划](#13-版本迭代计划)
14. [质量保障体系](#14-质量保障体系)
15. [性能优化指南](#15-性能优化指南)

---

## 1. 项目概述

### 1.1 产品定位

一款面向全年龄用户的旅游行程规划工具，核心价值是**降低用户做旅行攻略的时间成本**，提供真实、可执行的行程推荐。

### 1.2 产品形态

微信小程序，分两个独立入口：

| 入口 | 功能描述 | 用户场景 |
|---|---|---|
| 行程规划 | 用户确定目的地后，生成每日行程安排 | 已决定去某个地方，懒得自己规划 |
| 随机玩 | 根据位置+预算+天数推荐目的地 | 不知道去哪，想找灵感 |

### 1.3 核心用户故事

**入口A - 行程规划：**
```
用户选择了「成都市」+「都江堰市」，出行日期 2026-05-01，天数 3天，游玩方式 [网红打卡, 寻找美食]，补充说明「带老人不想走太多路」
→ 系统生成 3 天行程，每天包含景点 / 美食 / 住宿安排，可编辑导出
```

**入口B - 随机玩：**
```
用户位于「武汉市」，人均预算 2000-5000，游玩天数 3 天，游玩方式 [轻松度假, 寻找美食]
→ 系统推荐 3 个适合的目的地（长沙/张家界/厦门），各附行程预览，点击可进入完整行程
```

### 1.4 数据来源优先级

| 优先级 | 来源 | 用途 | 风险 |
|---|---|---|---|
| P0 | 高德地图 Web API | POI 查询、地理编码、路线规划 | 额度限制（免费5000次/日） |
| P1 | AI 生成（Claude/GPT） | 行程内容生成 | 模型成本、响应速度 |
| P2 | 小红书（爬虫态） | 精选内容参考，补充原生感 | 法律风险、IP封禁 |
| P3 | 自有用户数据 | 个性化推荐（v2.0+） | 冷启动问题 |

### 1.5 技术选型

| 层级 | 技术选型 | 说明 |
|---|---|---|
| 前端 | 原生微信小程序 | 无框架依赖，减少体积和学习成本 |
| 后端 | 腾讯云开发 / Node.js | 云开发免运维，适合早期迭代 |
| AI 服务 | Claude API / GPT-4o Mini | 行程生成 |
| 数据存储 | 云开发数据库 / SQLite | 云开发用内置NoSQL，生产环境可用MySQL |
| 地图 | 高德地图 Web API | 主力数据源 |

---

## 2. 技术架构总览

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        微信小程序端                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐   │
│  │首页     │  │行程规划  │  │随机玩   │  │我的(偏好)    │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘   │
└───────┼────────────┼───────────┼───────────────┼────────────┘
        │            │           │               │
        ▼            ▼           ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                      云开发网关层                            │
│          (HTTPS API / 鉴权 / 请求分发 / 限流)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  高德地图API  │  │    AI 服务       │  │   小红书爬虫     │
│  (POI/路线)  │  │ (Claude/GPT)     │  │   (补充来源)     │
└──────────────┘  └──────────────────┘  └──────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
              ┌─────────────────────────┐
              │     云开发数据库          │
              │  (行政区划/POI缓存/      │
              │   用户偏好/行程记录)       │
              └─────────────────────────┘
```

### 2.2 数据流向

**入口A（行程规划）数据流：**
```
用户选择目的地 → 行政区划API → 高德POI搜索 → AI生成行程 → 数据库存储 → 小程序展示
```

**入口B（随机玩）数据流：**
```
用户当前位置 → 预算/天数筛选 → 目的地候选集 → 标签匹配排序 → AI生成行程预览 → 展示推荐列表
```

### 2.3 核心模块依赖关系

```
模块A: 行政区划服务
  └─ 被依赖：目的地选择、随机玩推荐
  └─ 数据源：region-data/region.json（民政部公开数据）

模块B: POI查询服务
  └─ 被依赖：行程生成
  └─ 数据源：高德地图 API

模块C: AI行程生成服务
  └─ 被依赖：行程生成、随机玩行程预览
  └─ 数据源：高德POI + 用户偏好 + Prompt模板

模块D: 用户偏好系统
  └─ 被依赖：个性化推荐（v2.0+）
  └─ 数据源：用户行为埋点

模块E: 小红书爬虫服务
  └─ 被依赖：AI生成的内容补充参考
  └─ 数据源：小红书网页（非登录态）
```

---

## 3. 前端小程序架构

### 3.1 技术栈

- **框架：** 原生微信小程序（Miniprogram）
- **语法：** JavaScript / WXML / WXSS / JSON
- **状态管理：** 小程序内置 `App` 实例globalData + 页面 `data`
- **网络请求：** `wx.request` 封装
- **本地存储：** `wx.getStorageSync` / `wx.setStorageSync`

### 3.2 页面清单

| 页面 | 路径 | 功能 |
|---|---|---|
| 首页 | `pages/index/index` | 两个入口卡片：行程规划 / 随机玩 |
| 行程规划-目的地 | `pages/plan/destination/destination` | 省市区三级联动选择 |
| 行程规划-参数 | `pages/plan/params/params` | 日期、天数、游玩方式、补充说明 |
| 行程规划-结果 | `pages/plan/result/result` | AI生成的行程展示，支持编辑 |
| 随机玩-输入 | `pages/discover/input/input` | 位置、天数、预算、偏好 |
| 随机玩-结果 | `pages/discover/result/result` | 推荐目的地列表（Top3） |
| 我的 | `pages/profile/profile` | 偏好标签管理、历史行程 |

### 3.3 页面跳转关系

```
index (首页)
  ├── plan/
  │     ├── destination → params → result
  │     └── （result 可返回 params 重新编辑）
  ├── discover/
  │     ├── input → result
  │     └── （result 可返回 input 重新输入）
  └── profile/
```

### 3.4 组件清单

| 组件名 | 功能 | 所在目录 |
|---|---|---|
| `destination-picker` | 省市区三级联动选择器 | `components/destination-picker/` |
| `date-range-picker` | 日期范围选择器 | `components/date-range-picker/` |
| `trip-card` | 行程卡片（单日行程展示） | `components/trip-card/` |
| `trip-item` | 行程项（景点/美食/住宿） | `components/trip-item/` |
| `preference-tag` | 偏好标签选择器 | `components/preference-tag/` |
| `budget-slider` | 预算滑块 | `components/budget-slider/` |
| `loading-skeleton` | 骨架屏加载态 | `components/loading-skeleton/` |
| `empty-state` | 空状态占位 | `components/empty-state/` |

### 3.5 公共工具函数（utils/）

| 文件 | 导出函数 | 说明 |
|---|---|---|
| `request.js` | `request(options)`, `get(url, data)`, `post(url, data)` | 封装 wx.request，统一错误处理和鉴权 |
| `date.js` | `formatDate(date)`, `addDays(date, n)`, `getDateRange(start, end)` | 日期处理工具 |
| `storage.js` | `get(key)`, `set(key, value)`, `remove(key)` | 本地存储封装 |
| `validate.js` | `isValidPhone(text)`, `isValidDate(text)` | 表单验证工具 |
| `logger.js` | `log(msg, level)`, `error(msg)`, `warn(msg)` | 开发环境日志 |

### 3.6 全局配置（app.js）

```javascript
// app.js 全局数据
App({
  globalData: {
    userInfo: null,           // 微信用户信息
    preferences: [],          // 用户偏好标签
    recentTrips: [],          // 最近行程记录
    regionData: null,         // 行政区划数据缓存
    amapKey: '',              // 高德地图 Key
  }
})
```

### 3.7 交互规范

| 交互 | 规范 |
|---|---|
| 目的地区选择 | 三级联动 picker，不做搜索列表 |
| 行程展示 | 时间线形式，从上到下按游览顺序 |
| 编辑操作 | 左滑删除、拖拽排序（长按触发） |
| 加载状态 | 骨架屏，不做纯 spinner |
| 空状态 | 明确引导文案+操作按钮 |
| 页面间传参 | 使用 `wx.navigateTo` 的 `events` 机制或 URL 参数 |

---

## 4. 后端服务架构

### 4.1 部署形态

**推荐：腾讯云开发（CloudBase）**

- 免服务器运维
- 自动弹性扩缩容
- 与微信平台天然打通
- 免费额度足够 MVP 阶段

**备选：Node.js + Express 部署至云服务器**

适用于：
- 数据量超出台北云免费额度
- 需要更灵活的自定义配置
- 后续可能接入其他前端（Web/H5）

### 4.2 云函数清单

| 云函数名 | 触发方式 | 功能 |
|---|---|---|
| `getProvinces` | 客户端调用 | 获取省份列表 |
| `getCities` | 客户端调用 | 获取某省下地级市 |
| `getDistricts` | 客户端调用 | 获取某市下区县 |
| `searchPOI` | 客户端调用 | 搜索景点/餐厅/酒店 POI |
| `generateTrip` | 客户端调用 | AI 生成行程 |
| `recommendDestinations` | 客户端调用 | 随机玩推荐 |
| `saveUserPreference` | 客户端调用 | 保存用户偏好 |
| `getUserPreferences` | 客户端调用 | 获取用户偏好 |
| `crawlXiaohongshu` | 定时触发 | 小红书数据采集（每日1次） |

### 4.3 环境变量配置

| 变量名 | 说明 | 来源 |
|---|---|---|
| `AMAP_KEY` | 高德地图 Web API Key | 高德开放平台申请 |
| `AMAP_SECRET` | 高德地图 Web API Secret | 高德开放平台申请（用于签名校验） |
| `AI_PROVIDER` | AI 服务商（claude/gpt） | 手动配置 |
| `AI_API_KEY` | AI 服务 API Key | Claude/GPT 账号 |
| `WEIXIN_APPID` | 微信小程序 AppID | 微信公众平台 |
| `WEIXIN_SECRET` | 微信小程序 AppSecret | 微信公众平台 |

### 4.4 错误码规范

| 错误码 | 含义 | HTTP Status |
|---|---|---|
| `SUCCESS` | 请求成功 | 200 |
| `PARAM_ERROR` | 参数错误 | 400 |
| `UNAUTHORIZED` | 未授权/鉴权失败 | 401 |
| `FORBIDDEN` | 无权限 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `RATE_LIMIT` | 请求过于频繁 | 429 |
| `AMAP_ERROR` | 高德 API 调用失败 | 500 |
| `AI_ERROR` | AI 服务调用失败 | 500 |
| `INTERNAL_ERROR` | 内部服务器错误 | 500 |

---

## 5. 数据库设计

### 5.1 云开发 NoSQL 集合设计

> 以下为云开发集合（Collection）设计。若使用 MySQL，可转换为对应表结构。

#### 集合：`regions`（行政区划）

```
{
  _id: ObjectId,
  level: Number,        // 1:省 2:市 3:区县
  code: String,         // 行政区划代码（如 510100）
  name: String,         // 行政名称（如 成都市）
  parent_code: String,  // 父级代码（如 510000），省级为 null
  lat: Number,          // 省会/市中心纬度（估算）
  lng: Number,          // 省会/市中心经度（估算）
  children: [String],   // 下级名称数组（仅用于构建树）
  updated_at: Date
}
```

#### 集合：`poi_cache`（POI 缓存）

```
{
  _id: ObjectId,
  keyword: String,      // 搜索关键词
  city: String,         // 所属城市
  type: String,         // poi_type: scenic/food/hotel
  items: [Object],      // POI 列表（高德返回的原始数据）
  total: Number,        // 总数量
  cached_at: Date,      // 缓存时间
  expires_at: Date      // 过期时间（默认7天）
}
```

> POI 缓存策略：相同关键词+城市+类型，7天内不重复请求高德 API

#### 集合：`trip_templates`（行程模板，AI 兜底用）

```
{
  _id: ObjectId,
  destination: String,  // 目的地（如 成都市）
  days: Number,          // 天数（1-14）
  style: [String],       // 游玩方式标签
  itinerary: Object,     // 行程内容（见下方结构）
  is_default: Boolean,   // 是否为默认模板
  version: Number,        // 模板版本
  created_at: Date,
  updated_at: Date
}
```

#### 集合：`user_preferences`（用户偏好）

```
{
  _id: ObjectId,
  openid: String,        // 微信用户唯一标识
  tags: [String],        // 偏好标签数组
  visited_destinations: [String],  // 去过的目的地
  favorite_styles: [String],       // 偏好的游玩方式
  budget_level: String,  // 预算等级
  updated_at: Date,
  created_at: Date
}
```

#### 集合：`trip_records`（行程记录）

```
{
  _id: ObjectId,
  openid: String,
  trip_id: String,       // UUID
  destinations: [String],
  start_date: String,
  days: Number,
  styles: [String],
  extra_info: String,    // 用户补充说明
  itinerary: Object,      // 生成的行程内容
  status: String,        // created/shared/completed
  source: String,        // plan/discover
  created_at: Date,
  updated_at: Date
}
```

#### 集合：`xiaohongshu_cache`（小红书内容缓存）

```
{
  _id: ObjectId,
  keyword: String,       // 关联关键词
  note_id: String,       // 笔记 ID
  title: String,
  summary: String,       // AI 整理后的摘要（200字内）
  tags: [String],
  likes: Number,
  scraped_at: Date,
  expires_at: Date       // 30天后过期
}
```

### 5.2 数据库索引设计

| 集合 | 索引字段 | 类型 | 用途 |
|---|---|---|---|
| `regions` | `code` | unique | 按代码快速查询 |
| `regions` | `parent_code` | normal | 按父级查询子级 |
| `poi_cache` | `keyword+city+type` | compound unique | POI 缓存命中 |
| `trip_templates` | `destination+days+style` | compound | 模板匹配 |
| `user_preferences` | `openid` | unique | 用户偏好查询 |
| `trip_records` | `openid+created_at` | compound | 用户行程历史 |
| `xiaohongshu_cache` | `keyword` | normal | 按关键词查笔记 |

---

## 6. API接口设计

### 6.1 请求格式规范

所有请求均为 `HTTPS POST` 或 `GET`，请求体为 JSON 格式。

**通用请求头：**
```
Content-Type: application/json
X-WX-Openid: {openid}          // 已登录用户的 openid
X-WX-Unionid: {unionid}        // 用户的 unionid（如有）
X-Request-Id: {uuid}           // 请求唯一ID，用于日志追踪
```

**通用响应格式：**
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": { ... },
  "request_id": "uuid"
}
```

**错误响应格式：**
```json
{
  "code": "PARAM_ERROR",
  "message": "日期格式错误",
  "data": null,
  "request_id": "uuid"
}
```

### 6.2 API 详情

#### 6.2.1 获取省份列表

```
GET /getProvinces
```

响应：
```json
{
  "code": "SUCCESS",
  "data": [
    { "code": "110000", "name": "北京市" },
    { "code": "500000", "name": "重庆市" },
    { "code": "510000", "name": "四川省" },
    ...
  ]
}
```

#### 6.2.2 获取地级市列表

```
GET /getCities?province_code={code}
```

#### 6.2.3 获取区县列表

```
GET /getDistricts?city_code={code}
```

#### 6.2.4 搜索 POI

```
POST /searchPOI
Body: {
  "keywords": ["宽窄巷子", "锦里"],
  "city": "成都市",
  "type": "scenic",       // scenic | food | hotel
  "city_code": "510100"
}
```

#### 6.2.5 AI 生成行程

```
POST /generateTrip
Body: {
  "openid": "string",
  "destinations": ["成都市", "都江堰市"],
  "start_date": "2026-05-01",
  "days": 3,
  "styles": ["网红打卡", "寻找美食"],
  "extra_info": "带老人不想走太多路",
  "pois": {
    "成都市": { "scenic": [...], "food": [...], "hotel": [...] },
    "都江堰市": { "scenic": [...], "food": [...], "hotel": [...] }
  }
}
```

响应：
```json
{
  "code": "SUCCESS",
  "data": {
    "trip_id": "uuid",
    "destinations": ["成都市", "都江堰市"],
    "days": 3,
    "start_date": "2026-05-01",
    "itinerary": [
      {
        "day": 1,
        "date": "2026-05-01",
        "items": [
          {
            "type": "spot",
            "name": "宽窄巷子",
            "address": "成都市青羊区长顺街附近",
            "duration": "2小时",
            "description": "清代古街，体验成都慢生活",
            "transport_to_next": "步行10分钟"
          }
        ]
      }
    ],
    "generated_at": "2026-04-21T12:00:00Z"
  }
}
```

#### 6.2.6 随机玩推荐

```
POST /recommendDestinations
Body: {
  "openid": "string",
  "location": { "lat": 30.5728, "lng": 114.2529 },  // GPS 坐标
  "location_name": "武汉市",    // 地级市名称
  "days": 3,
  "budget": "2000-5000",       // 预算区间
  "styles": ["轻松度假", "寻找美食"]
}
```

#### 6.2.7 保存用户偏好

```
POST /saveUserPreference
Body: {
  "openid": "string",
  "tags": ["成都市", "网红打卡", "川菜"],
  "action": "add"              // add | remove | replace
}
```

#### 6.2.8 获取用户偏好

```
GET /getUserPreferences?openid={openid}
```

---

## 7. AI服务设计

### 7.1 模型选择

| 阶段 | 模型 | 单次行程生成成本（估算） |
|---|---|---|
| 开发/测试 | MiniMax-M2 (abab6.5s-chat) | < ¥0.05 |
| 生产 | MiniMax-M2 (abab6.5s-chat) | ¥0.02 - ¥0.1 |
| 备选 | Claude Sonnet 4 / GPT-4o Mini | 视定价 |

> **AI 供应商：** MiniMax（与当前 Agent 使用模型一致，兼容 OpenAI 格式）
> **API 接入方式：** OpenAI 兼容端点，base URL 替换为 MiniMax 专线

### 7.2 Prompt 模板结构

```
## 系统角色
你是一位专业的旅行规划师，熟悉中国各大旅游目的地的景点、美食和住宿。

## 用户信息
- 目的地：{destinations}
- 出行日期：{start_date}
- 游玩天数：{days}天
- 游玩方式：{styles}
- 补充说明：{extra_info}

## 当地POI数据
{d poi_data}

## 输出要求
请为用户生成{days}天的行程安排，输出JSON格式：
{json_schema}

## 生成规则
1. 每天安排3-5个景点/活动，避免行程过于紧凑
2. 餐厅推荐需包含具体店名和推荐菜
3. 住宿建议在当天最后一个景点附近
4. 相邻景点间需注明预估交通方式和时间
5. 不添加任何广告或商业推广内容
6. 行程描述真实、具体、有参考价值
```

### 7.3 AI 生成失败降级策略

```
1. AI 请求超时（>10s）→ 返回「服务繁忙，请稍后再试」
2. AI 返回格式异常 → 触发重试（最多2次）
3. 重试仍失败 → 查询 trip_templates 默认模板
4. 无默认模板 → 提示用户「该目的地数据暂缺」
```

### 7.4 小红书内容补充规则

- 仅在 AI 生成「景点描述」和「美食推荐」时参考
- 爬取字段：标题 + 200字摘要 + 标签 → 不直接引用原文
- AI 处理后融入行程，不保留原始笔记痕迹
- 每次 AI 生成最多参考 3 篇小红书笔记

---

## 8. 目录结构规范

### 8.1 完整目录结构

```
travel-planner/
├── frontend/                         # 前端小程序代码
│   ├── app.js                        # 小程序入口
│   ├── app.json                      # 全局配置
│   ├── app.wxss                      # 全局样式
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.js
│   │   │   ├── index.wxml
│   │   │   ├── index.wxss
│   │   │   └── index.json
│   │   ├── plan/
│   │   │   ├── destination/
│   │   │   ├── params/
│   │   │   └── result/
│   │   ├── discover/
│   │   │   ├── input/
│   │   │   └── result/
│   │   └── profile/
│   ├── components/
│   │   ├── destination-picker/
│   │   ├── date-range-picker/
│   │   ├── trip-card/
│   │   ├── trip-item/
│   │   ├── preference-tag/
│   │   ├── budget-slider/
│   │   ├── loading-skeleton/
│   │   └── empty-state/
│   ├── utils/
│   │   ├── request.js
│   │   ├── date.js
│   │   ├── storage.js
│   │   ├── validate.js
│   │   └── logger.js
│   └── assets/
│       ├── icons/
│       └── images/
│
├── backend/                         # 后端服务代码
│   ├── cloudfunctions/              # 云函数目录
│   │   ├── getProvinces/
│   │   │   ├── index.js
│   │   │   └── package.json
│   │   ├── getCities/
│   │   ├── getDistricts/
│   │   ├── searchPOI/
│   │   ├── generateTrip/
│   │   ├── recommendDestinations/
│   │   ├── saveUserPreference/
│   │   ├── getUserPreferences/
│   │   └── crawlXiaohongshu/
│   ├── ai-service/                  # AI 服务相关
│   │   ├── prompt-templates/
│   │   │   ├── trip-generate.md
│   │   │   └── destination-recommend.md
│   │   ├── models/
│   │   │   ├── openai.js
│   │   │   └── claude.js
│   │   └── index.js
│   ├── api-docs/                   # API 文档
│   │   └── openapi.yaml
│   └── data-model/
│       └── schema.md
│
├── data/                            # 静态数据文件
│   ├── region-data/
│   │   └── region.json             # 行政区划数据
│   ├── poi-data/                   # POI 缓存数据
│   │   └── README.md               # 数据格式说明
│   └── content-templates/         # AI 兜底模板
│       ├── chengdu_3days.json
│       ├── hangzhou_2days.json
│       └── ...
│
├── scripts/                         # 工具脚本
│   ├── crawl/
│   │   └── xiaohongshu.js          # 小红书爬虫
│   ├── data/
│   │   ├── import-region.js       # 行政区划数据导入
│   │   └── export-templates.js    # 模板导出工具
│   └── deploy/
│       └── deploy-functions.js    # 云函数部署脚本
│
├── docs/                            # 设计文档
│   ├── planning/
│   │   └── 2026-04-21-旅游行程规划产品设计文档.md
│   ├── ui-design/                  # UI设计稿
│   └── ux-design/                   # 交互设计稿
│
├── notes/                           # 开发随笔和备份
│
├── .gitignore
├── README.md
└── CHANGELOG.md
```

### 8.2 前端目录规范

- 每个页面必须有 `js / wxml / wxss / json` 四个文件
- 组件目录与页面目录平级，放在 `components/` 下
- `utils/` 目录只放纯工具函数，不含业务逻辑
- `assets/` 存放静态资源，图片不超过 200KB

### 8.3 后端目录规范

- 每个云函数独立目录，目录名即函数名
- 云函数内必须包含 `package.json` 声明依赖
- AI 服务单独模块化，不写在云函数内部
- 敏感配置（Key/Secret）不允许写入代码，必须走环境变量

---

## 9. 开发规范

### 9.1 Git 工作流

**分支模型：** Git Flow（简化版）

```
main                    # 稳定上线版本
├── develop             # 开发主分支
│   ├── feature/xxx     # 功能分支
│   ├── fix/xxx         # 修复分支
│   └── release/v1.x    # 发布分支
```

**Commit 规范：**
```
feat: 新增行程导出功能
fix: 修复目的地选择器偶现空值问题
docs: 更新 API 文档
refactor: 重构 request 封装逻辑
perf: 优化 POI 缓存命中率
chore: 更新依赖版本
```

### 9.2 代码规范

**JavaScript 规范：**
- 遵循 ES6+ 语法
- 使用 `const` / `let`，禁止 `var`
- 缩进 2 空格（Tabs），编辑器配置一致
- 字符串统一使用单引号
- 异步使用 `async/await`，禁止回调嵌套
- 每个函数顶部注释说明功能

**微信小程序规范：**
- WXML 标签闭合（自闭合标签也要写 `/>`）
- 事件处理函数命名：`on{EventName}`（如 `onTapSubmit`）
- `data-*` 属性使用小写+横线（如 `data-trip-id`）
- 禁止在 WXML 中调用 JS 函数，只做数据绑定
- 页面 onLoad 中统一处理参数解析

### 9.3 API 设计规范

- RESTful 风格，名词复数形式（如 `/trips`, `/pois`）
- 请求参数不超过 10 个
- 响应数据嵌套不超过 3 层
- 所有列表返回包含分页信息 `{ data: [], total: 100, page: 1, page_size: 20 }`
- 不返回裸数组，始终包装为对象 `{ data: [...] }`

### 9.4 命名规范

| 类型 | 规范 | 示例 |
|---|---|---|
| 页面文件 | 小写横线 | `destination.js` |
| 组件名 | 小写横线 | `trip-card` |
| 组件引用 | kebab-case | `<trip-card />` |
| 函数名 | 小驼峰，动词前缀 | `generateTrip()`, `getUserPreferences()` |
| 常量 | 全大写下划线 | `MAX_RETRY_COUNT = 3` |
| 变量名 | 小驼峰 | `tripId`, `startDate` |
| 布尔变量 | is/has/can 前缀 | `isLoading`, `hasError` |
| CSS 类名 | BEM 规范（小程小序不建议BEM过重） | `.trip-card__title` |

---

## 10. 数据管理规范

### 10.1 数据更新频率

| 数据类型 | 更新频率 | 更新方式 |
|---|---|---|
| 行政区划数据 | 每年1次 | 民政部数据全量导入 |
| POI 缓存 | 实时（7天TTL） | API 请求时检查过期 |
| 小红书缓存 | 每日1次 | 定时爬虫任务 |
| 用户偏好 | 实时 | 用户操作触发 |
| AI 兜底模板 | 按需 | 运营人员编辑 |

### 10.2 数据清洗规则

**行政区划数据：**
- 过滤 `level = 0` 的无效记录
- 补全缺失的 `parent_code`
- 直辖市（北京/上海/天津/重庆）直接挂载区县，不走「市-县」层级

**POI 数据：**
- 过滤评分 `< 3.0` 的低质量结果
- 过滤距离目的地 `> 50km` 的过远 POI
- 景点类 POI 优先选择「评分人数 > 100」的结果

**AI 生成内容：**
- 检测并过滤包含「广告」「推广」「领取」「扫码」等关键词
- 过滤长度 < 10 字符的无效描述

### 10.3 备份策略

| 数据 | 备份频率 | 保留时间 |
|---|---|---|
| 用户行程记录 | 实时同步 | 永久 |
| POI 缓存 | 每日全量 | 30天 |
| 小红书缓存 | 每日增量 | 7天 |
| 行政区划 | 每次更新前备份旧版 | 永久 |

---

## 11. 安全规范

### 11.1 鉴权与权限

- 所有涉及用户数据的 API 必须校验 `openid`
- 使用微信提供的 `checkSession` 验证登录态
- 高德 API Key 仅在后端使用，禁止暴露在小程序端
- AI API Key 仅在云函数环境变量中，不进入代码仓库

### 11.2 数据安全

- 用户敏感信息（位置、偏好）不提供给第三方
- 行程数据仅用户本人可访问（校验 openid）
- 小红书爬虫数据仅供 AI 参考，不直接展示给用户
- 数据库访问走云开发自带权限控制，不自建鉴权逻辑

### 11.3 输入校验

- 所有用户输入在后端进行二次校验
- 特殊字符转义（`< > & ' "`）
- 字符串长度限制：补充说明 ≤ 500 字符

### 11.4 频率限制

| 接口 | 限制 |
|---|---|
| `/searchPOI` | 每用户每分钟 20 次 |
| `/generateTrip` | 每用户每小时 10 次 |
| `/recommendDestinations` | 每用户每小时 10 次 |
| 小红书爬虫 | 每日最多 500 条 |

---

## 12. 部署方案

### 12.1 小程序发布流程

```
开发环境调试
  ↓（代码 review）
提交测试版（微信开发者工具「上传」）
  ↓（管理员确认）
提交审核（1-3 个工作日）
  ↓（微信审核）
发布上线
```

### 12.2 云函数部署

```bash
# 安装腾讯云 CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署单个云函数
tcb fn deploy getProvinces

# 部署所有云函数
tcb fn deploy --all

# 查看云函数日志
tcb fn log getProvinces
```

### 12.3 环境配置

| 环境 | 用途 | 数据隔离 |
|---|---|---|
| 开发环境 | 本地调试 | 使用测试数据 |
| 体验版环境 | 内测用户 | 使用真实数据，生产数据库（可清空） |
| 正式环境 | 对外服务 | 完全隔离的生产数据库 |

### 12.4 域名白名单

小程序必须使用已备案域名，配置在 `小程序后台 → 开发管理 → 开发设置 → 服务器域名`：

```
request 合法域名：https://api.travel-planner.com
uploadFile 合法域名：https://upload.travel-planner.com
```

---

## 13. 版本迭代计划

### 13.1 v1.0.0（MVP，第一阶段）

**目标：完成核心行程规划流程**

| 功能 | 状态 |
|---|---|
| 省市区三级联动选择 | 待开发 |
| 日期+天数+游玩方式参数输入 | 待开发 |
| 高德 POI 查询（景点/美食/住宿） | 待开发 |
| AI 行程生成 | 待开发 |
| 行程结果展示与编辑 | 待开发 |
| 行程导出（复制为文本） | 待开发 |
| 行政区划数据初始化 | 待开发 |
| AI 兜底模板（10 个热门城市） | 待开发 |

**覆盖城市（第一期）：**
成都、重庆、西安、杭州、上海、北京、广州、深圳、厦门、三亚、南京、武汉、长沙、青岛、大理、丽江

### 13.2 v1.1.0（第二阶段）

| 功能 | 说明 |
|---|---|
| 随机玩入口 | 根据位置+预算+天数推荐目的地 |
| 目的地发现算法 | 基础版（规则+标签匹配） |
| 用户行为埋点 | 为 v2.0 推荐系统积累数据 |
| 分享到微信 | 小程序卡片分享 |
| 小红书精选内容接入 | 非登录态爬虫（补充来源） |

### 13.3 v2.0.0（第三阶段）

| 功能 | 说明 |
|---|---|
| 个性化推荐（冷启动） | 标签匹配推荐 |
| 协同过滤 | 用户相似度推荐 |
| 行程分享图片生成 | Canvas 动态生成 |
| 城市覆盖扩展 | 30 → 100 个城市 |
| 用户评价体系 | 对行程/景点评分 |

### 13.4 v2.1.0+（长期规划）

- 行程收藏与复用
- 同行人协作编辑
- 实时天气+行程调整
- 接入更多第三方数据源
- App 多端支持（iOS/Android）

---

## 14. 质量保障体系

### 14.1 测试策略

| 测试类型 | 覆盖内容 | 执行时机 |
|---|---|---|
| 单元测试 | 工具函数、日期处理、校验逻辑 | 每次 PR |
| 集成测试 | API 接口、数据库读写 | 每次 PR |
| E2E 测试 | 完整用户流程 | 每周回归 |
| 性能测试 | API 响应时间、并发数 | 每次发布前 |
| 安全测试 | SQL/NoSQL 注入、XSS | 每月 |

### 14.2 代码 Review 清单

- [ ] 代码符合 ESLint 规范，无 error
- [ ] 新增函数有注释说明
- [ ] API 有对应文档更新
- [ ] 数据库集合变更同步更新 schema
- [ ] 敏感信息未硬编码
- [ ] 有新增测试用例
- [ ] 页面路径变更同步更新导航配置

### 14.3 线上监控指标

| 指标 | 告警阈值 |
|---|---|
| API 错误率 | > 1% |
| AI 生成失败率 | > 5% |
| P99 响应时间 | > 3s |
| 高德 API 配额使用率 | > 80% |

---

## 15. 性能优化指南

### 15.1 前端性能

| 优化点 | 具体措施 |
|---|---|
| 首屏加载 | 分包加载，非首页资源按需注入 |
| 图片加载 | 使用 `mode="widthFix"` 自动缩放，不超过原始尺寸 |
| 列表渲染 | 长列表使用 `wx:if` 代替 `hidden`，减少内存占用 |
| 多次 setData | 合并数据更新，使用 `this.setData({ ...obj })` 一次更新 |
| 预加载 | 行程结果页在 AI 生成时预拉取下一页数据 |

### 15.2 后端性能

| 优化点 | 具体措施 |
|---|---|
| POI 缓存 | 7 天 TTL，同一关键词不重复请求高德 |
| 数据库查询 | 关键字段建索引，避免全表扫描 |
| AI 并发 | 行程生成任务加锁，防止同一用户重复提交 |
| 冷启动 | 云函数保持最小实例数，避免 0 实例状态 |

### 15.3 AI 服务性能

- 单次行程生成 **P99 延迟目标 < 8 秒**
- 超出 10 秒自动触发降级策略
- 结果异步推送，不阻塞用户等待

---

## 附录

### A. 环境变量清单

| 变量 | 开发环境 | 体验环境 | 生产环境 |
|---|---|---|---|
| `AMAP_KEY` | ✅ | ✅ | ✅ |
| `AMAP_SECRET` | ✅ | ✅ | ✅ |
| `AI_PROVIDER` | claude | claude | claude |
| `AI_API_KEY` | ✅ | ✅ | ✅ |
| `CLOUDBASE_ENV_ID` | ✅ | ✅ | ✅ |

### B. 高德 API 申请指南

1. 访问 https://console.amap.com/dev/key/app
2. 创建 Web 应用，获取 Key 和 Secret
3. 在「控制台 → 额度提升」申请个人认证，解锁每日 5000 次免费额度
4. 注意：Key 需添加到微信小程序后台「request 合法域名」

### C. 微信小程序申请指南

1. 访问 https://mp.weixin.qq.com/ 注册小程序
2. 获取 AppID 和 AppSecret
3. 云开发环境初始化（腾讯云控制台）
4. 配置服务器域名白名单

---

*本文档为 TravelPlanner 项目开发主参考文档，所有开发工作应以此为准。如有更新，需同步更新文档并通知团队。*
