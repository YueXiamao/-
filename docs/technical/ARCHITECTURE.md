# 技术架构文档

**版本：** v1.0
**日期：** 2026-04-21
**状态：** 已确认

---

## 一、系统架构总览

### 1.1 架构风格

采用**前后端分离 + 云原生**架构，后端部署于腾讯云，微信小程序通过 wx.request 调用后端 RESTful API。

```
┌─────────────────────────────────────────────────────────────┐
│                     微信小程序（微信生态）                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │首页/入口 │  │行程规划页│  │随机玩页  │  │ 我的页面  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼────────────┼────────────┼────────────┼───────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                            │ HTTPS (JSON)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    腾讯云后端服务                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │  API Gateway │───▶│  Node.js    │───▶│  MySQL       │    │
│  │  (路由/鉴权) │    │  Koa/Fastify │    │  (主库)      │    │
│  └─────────────┘    └──────┬──────┘    └─────────────┘    │
│                            │                              │
│                     ┌──────▼──────┐                       │
│                     │   Redis      │   ← 缓存层             │
│                     └─────────────┘                       │
│                            │                              │
│              ┌─────────────┼─────────────┐                │
│              ▼             ▼             ▼                │
│        ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│        │ 高德地图  │ │ AI 服务   │ │ 小红书   │            │
│        │   API    │ │(Claude/   │ │  爬虫    │            │
│        └──────────┘ │ GPT-4o)  │ └──────────┘            │
│                     └──────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术选型

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端 | 原生微信小程序 | 无框架依赖，减少体积 |
| 后端 Runtime | Node.js 20 LTS | 非阻塞 I/O，适合 I/O 密集型业务 |
| 后端框架 | Fastify | 比 Koa 性能更好，JSON Schema 验证 |
| 数据库 | MySQL 8.0 | 关系型数据存储 |
| 缓存 | Redis 7 | 会话缓存 + API 限流 |
| AI 服务 | Claude API / GPT-4o Mini | 行程生成 |
| 地图服务 | 高德地图 Web API | POI 搜索、地理编码 |
| 文件存储 | 腾讯云 COS | 行程分享图片存储 |
| 部署 | 腾讯云云开发（SCF） | 函数计算，冷启动，零运维 |

---

## 二、项目结构

### 2.1 后端目录结构

```
backend/
├── src/
│   ├── index.js              # 入口文件
│   ├── config/
│   │   └── index.js          # 配置文件（环境变量）
│   ├── routes/
│   │   ├── index.js          # 路由聚合
│   │   ├── destinations.js   # 行政区划路由
│   │   ├── pois.js           # POI 查询路由
│   │   ├── trip.js           # 行程生成路由
│   │   └── discover.js       # 随机玩路由
│   ├── services/
│   │   ├── destinationService.js  # 行政区划服务
│   │   ├── poiService.js          # 高德 POI 服务
│   │   ├── tripService.js         # 行程编排服务
│   │   ├── discoverService.js     # 随机玩推荐服务
│   │   └── userService.js         # 用户偏好服务
│   ├── models/
│   │   ├── User.js
│   │   ├── Trip.js
│   │   ├── UserPreference.js
│   │   └── Destination.js
│   ├── ai/
│   │   ├── generator.js      # AI 生成器
│   │   └── prompts.js        # Prompt 模板
│   ├── crawler/
│   │   └── xiaohongshu.js    # 小红书爬虫
│   ├── middleware/
│   │   ├── errorHandler.js   # 全局错误处理
│   │   └── rateLimiter.js    # 限流中间件
│   └── utils/
│       ├── amap.js           # 高德 API 封装
│       ├── validator.js      # 参数校验
│       └── cache.js          # Redis 缓存工具
├── scripts/
│   ├── init-region-data.js   # 初始化行政区划数据
│   └── seed-content.js       # 填充内容模板
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── .env.example
```

### 2.2 小程序目录结构

```
frontend/
├── app.js                     # 小程序入口
├── app.json                   # 全局配置
├── app.wxss                   # 全局样式
├── pages/
│   ├── index/                 # 首页
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   ├── plan/
│   │   ├── destination/       # 目的地选择
│   │   ├── params/            # 行程参数
│   │   └── result/             # 行程结果
│   ├── discover/
│   │   ├── input/              # 随机玩输入
│   │   └── result/             # 随机玩结果
│   └── profile/                # 我的
├── components/
│   ├── region-picker/         # 行政区划选择器
│   ├── trip-card/            # 行程卡片
│   ├── day-schedule/          # 每日行程
│   ├── poi-item/             # POI 单项
│   ├── tag-selector/         # 标签选择器
│   └── loading-skeleton/     # 骨架屏
├── services/
│   ├── api.js                 # API 请求封装
│   ├── destinations.js       # 行政区划 API
│   ├── pois.js               # POI API
│   ├── trip.js               # 行程 API
│   └── discover.js           # 随机玩 API
├── utils/
│   ├── constants.js           # 常量
│   ├── format.js              # 格式化工具
│   ├── storage.js             # 本地存储
│   └── validate.js            # 校验工具
└── assets/
    ├── images/                 # 图片资源
    └── icons/                  # 图标资源
```

---

## 三、核心模块设计

### 3.1 行政区划模块

**数据来源：** 民政部公开行政区划 JSON（每年更新一次）

**加载策略：**
- 启动时一次性加载到内存（全国数据约 3-5MB，可接受）
- 同时写入 MySQL 做持久化（支持按省/市/区县快速查询）
- Redis 缓存省/市/区县列表（TTL: 24小时）

**API 接口：**
```
GET /api/destinations/provinces          → 获取所有省份
GET /api/destinations/cities?province=xxx → 获取某省下地级市
GET /api/destinations/districts?city=xxx → 获取某市下区县
GET /api/destinations/search?q=xxx       → 模糊搜索市/县
```

### 3.2 POI 查询模块

**高德 API 封装：**
- 所有请求经过 `amap.js` 封装，统一处理签名和错误
- 请求限流：单 key 每天 5000 次，小程序端按需调用
- 结果缓存：热门景点缓存 7 天，餐厅缓存 3 天

**POI 类型映射：**
| 用户看到的分类 | 高德 POI 类型 |
|---|---|
| 景点 | 旅游景点、公园、博物馆 |
| 餐厅 | 餐饮类 |
| 酒店 | 住宿服务 |

### 3.3 行程生成模块

详见 `AI_SERVICE.md`

### 3.4 随机玩推荐模块

**目的地候选池：**
- 预定义 200 个热门旅游目的地（含经纬度、消费水平、标签）
- 覆盖：热门旅游城市 + 周边特色县/镇

**推荐算法（v1.0 规则版）：**
```
function recommend(currentLocation, days, budget, preferences):
  candidates = filter_by_distance(currentLocation, days)
  candidates = filter_by_budget(candidates, budget)
  candidates = match_preferences(candidates, preferences)
  return top_n(candidates, n=3)
```

---

## 四、部署架构

### 4.1 环境划分

| 环境 | 用途 | 访问 |
|---|---|---|
| 开发环境 | 本地调试 | localhost:3000 |
| 测试环境 | 联调测试 | test-api.travel.local |
| 生产环境 | 正式上线 | api.travel.com |

### 4.2 部署方式

**后端：** 腾讯云函数（SCF）+ API Gateway
- 优势：零运维，自动弹性伸缩，按调用次数计费
- 劣势：有冷启动延迟（首次调用 1-3 秒）

**备选方案：** 腾讯云 CVM（长期运行，无冷启动）

### 4.3 监控与告警

| 指标 | 告警阈值 | 处理方式 |
|---|---|---|
| API 5xx 错误率 | > 1% | 短信通知 |
| AI 生成延迟 | > 10s | 记录日志 |
| 高德 API 超限 | 每日 > 4000 次 | 切换备用 Key |
| Redis 连接失败 | 连续 3 次 | 自动降级到无缓存 |

---

## 五、安全设计

### 5.1 前后端交互安全

- 所有 API 必须通过 HTTPS 访问
- 后端验证请求来源（微信小程序 `openid` 鉴权）
- 敏感配置（API Key）不存储在小程序端

### 5.2 数据库安全

- 数据库密码定期轮换（90天）
- 禁止将生产数据库密码提交到代码仓库
- 敏感字段（手机号）加密存储

### 5.3 爬虫安全红线

- 单 IP 请求频率 ≤ 10次/分钟
- 每次抓取间隔 ≥ 2 秒
- 不抓取需登录才能访问的内容
- 不存储原始内容，仅存 AI 整理后的摘要

---

## 六、扩展性考虑

### 6.1 AI 模型切换

行程生成模块与 AI Provider 解耦，通过配置切换：
```js
// config/index.js
module.exports = {
  ai: {
    provider: process.env.AI_PROVIDER || 'claude', // 'claude' | 'openai' | 'zhipu'
    model: 'claude-sonnet-4-6'
  }
}
```

### 6.2 地图服务商切换

同理，高德封装层 `amap.js` 抽象了底层调用，后续可切换到腾讯/百度地图。

### 6.3 数据库读写分离

v1.0 单库足够，当读请求成为瓶颈时：
- 读库（只读副本）处理 POI 查询
- 写库处理用户数据和行程存储
