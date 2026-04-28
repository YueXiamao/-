# Hermes Agent 直接开发任务书

> **用途：** 这份文档给 Hermes agent 直接作为开发输入使用。  
> **目标：** 把当前旅游小程序从“主流程可跑通”推进到“上线前可验收”的状态。  
> **优先级：** 先完成 P0 闭环与安全项，再做 P1 体验增强。  
> **重要约束：** 当前工作区已有未提交改动 `backend/src/ai/generator.js`，除非任务明确需要，不要覆盖或回退该文件。

---

## 0. Agent 执行规则

Hermes 开始前必须先做以下检查：

1. 运行 `git status --short`，记录已有改动。
2. 阅读以下文档：
   - `planning/SPEC.md`
   - `docs/ui-design/README.md`
   - `docs/technical/API.md`
   - `docs/PROJECT_GAP_AND_IMPROVEMENT.md`
3. 不要提交真实密钥，不要读取后在输出中展示 `.env` 的具体值。
4. 不要把前端页面继续写死到 `http://localhost:3000`。
5. 小程序 UI 中不要新增 emoji；已有 emoji 应逐步替换为文字短标或本地资源。
6. 测试中不要依赖真实高德、微信、AI 服务。后端测试使用 `SKIP_EXTERNAL_POI=true`、`SKIP_AI=true`。

推荐执行顺序：

1. P0-1 前端 API 与环境配置统一
2. P0-2 微信登录闭环修复
3. P0-3 高德逆地理迁移到后端
4. P0-4 随机玩详情与转行程闭环
5. P0-5 API 响应与文档对齐
6. P1-1 行程可信字段
7. P1-2 UI 规范清理
8. P1-3 用户反馈与基础埋点

---

## 1. 当前项目关键信息

### 技术栈

| 端 | 技术 |
|---|---|
| 前端 | 微信原生小程序，WXML/WXSS/JS |
| 后端 | Node.js 20、Fastify、SQLite/MySQL 兼容 |
| 缓存 | Redis 可选 |
| 外部服务 | 高德 Web API、微信登录、OpenAI 兼容 AI 服务 |
| 测试 | Node built-in test runner |

### 主要目录

| 路径 | 用途 |
|---|---|
| `frontend/pages/index/` | 首页双入口 |
| `frontend/pages/plan/` | 行程规划流程 |
| `frontend/pages/discover/` | 随机玩流程 |
| `frontend/pages/profile/` | 我的行程 |
| `frontend/services/` | 前端 API 封装 |
| `frontend/constants/index.js` | 前端常量、API 地址、偏好选项 |
| `backend/src/routes/` | 后端路由 |
| `backend/src/services/` | 后端业务服务 |
| `backend/src/services/trip-generation/` | 行程生成编排 |
| `backend/test/backend-contract.test.js` | 后端契约测试 |
| `frontend/test/` | 前端逻辑测试 |

### 验证命令

后端：

```powershell
cd backend
npm test
```

前端：

```powershell
cd frontend
node --test test/*.mjs
```

全局硬编码检查：

```powershell
Get-ChildItem -Recurse -File frontend |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  Select-String -Pattern 'http://localhost|restapi.amap.com|🔍|📍|💰|🍜|⭐|🕘|⏱|🎫'
```

最终验收时，`http://localhost` 只允许出现在环境配置、示例文档或测试说明中，不允许出现在页面业务代码中。

---

## 2. P0-1 前端 API 与环境配置统一

### 目标

所有前端网络请求统一走 `frontend/services/api.js`，移除页面内硬编码的 `localhost` 和直接请求第三方 API 的写法。

### 涉及文件

修改：

- `frontend/constants/index.js`
- `frontend/services/api.js`
- `frontend/utils/api.js`
- `frontend/app.js`
- `frontend/pages/index/index.js`
- `frontend/pages/discover/input/input.js`
- `frontend/pages/discover/result/result.js`

新增或修改测试：

- `frontend/test/api-config.test.mjs`
- `frontend/test/discover-flow.test.mjs`

### 实施要求

1. 在 `frontend/constants/index.js` 中建立唯一 API 配置。
2. 开发环境默认 `http://localhost:3000`，但生产环境必须能切换到 `API_BASE_URL`。
3. `frontend/services/api.js` 成为唯一请求入口。
4. `frontend/utils/api.js` 如果仍被引用，应改为转发 `services/api.js`，避免两套封装。
5. `frontend/app.js` 登录请求也必须复用统一 Base URL。
6. `discover/input.js` 的省市区请求改用 `destinationsApi` 或 `api.get`。
7. `discover/result.js` 的推荐请求改用 `frontend/services/discover.js`。

### 验收标准

- 页面 JS 中不再出现 `url: 'http://localhost:3000...`。
- `frontend/pages/discover/input/input.js` 不再直接调用 `http://localhost:3000/api/destinations/*`。
- `frontend/pages/discover/result/result.js` 不再直接 `wx.request` 调 `/api/discover/recommend`。
- 前端测试通过：

```powershell
cd frontend
node --test test/*.mjs
```

---

## 3. P0-2 微信登录闭环修复

### 目标

用户打开小程序后自动完成 `wx.login -> /api/auth/login -> openid 存储`，保存行程和我的页面无需用户手动处理登录。

### 涉及文件

修改：

- `frontend/app.js`
- `frontend/services/auth.js`
- `frontend/services/api.js`
- `frontend/pages/profile/profile.js`
- `backend/src/routes/auth.js`

新增或修改测试：

- `frontend/test/auth-login.test.mjs`
- `backend/test/backend-contract.test.js`

### 实施要求

1. `frontend/services/auth.js` 提供 `login()`、`ensureLogin()`。
2. `App.onLaunch()` 调用 `ensureLogin()`。
3. `services/api.js` 每次请求自动附带 `X-OpenID`。
4. `profile.onShow()` 如果没有 openid，先调用登录，再加载行程。
5. 后端 `/api/auth/login` 返回格式保持前端可读：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "openid": "xxx",
    "user_id": 1,
    "is_new_user": true
  }
}
```

兼容期内也可以让前端兼容旧格式 `{ openid }`，但新响应必须是统一格式。

### 验收标准

- 清空本地 `openid` 后打开小程序，会自动写入 `wx.setStorageSync('openid', openid)`。
- 保存行程不会因为缺少 `X-OpenID` 失败。
- 我的页面首次打开能自动登录并拉取列表。
- 后端测试通过。

---

## 4. P0-3 高德逆地理迁移到后端

### 目标

前端不得暴露高德 Web API Key。随机玩定位只把经纬度传给后端，由后端完成逆地理编码并返回省市区。

### 涉及文件

新增：

- `backend/src/routes/location.js`
- `backend/src/services/locationService.js`
- `frontend/services/location.js`

修改：

- `backend/src/index.js`
- `backend/src/config/index.js`
- `frontend/pages/discover/input/input.js`

新增或修改测试：

- `backend/test/backend-contract.test.js`
- `frontend/test/discover-location.test.mjs`

### 后端接口

新增：

```http
POST /api/location/regeo
Content-Type: application/json
```

请求：

```json
{
  "latitude": 30.5728,
  "longitude": 104.0668
}
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "province": "四川省",
    "city": "成都市",
    "district": "锦江区",
    "formatted_address": "四川省成都市锦江区..."
  }
}
```

失败响应：

```json
{
  "code": 20001,
  "message": "位置识别失败，请手动选择"
}
```

### 实施要求

1. 后端服务读取 `config.amap.key`。
2. 测试环境可通过 mock 或 `SKIP_EXTERNAL_POI=true` 避免真实请求。
3. 前端 `discover/input.js` 的 `doReverseGeocode()` 改为调用 `frontend/services/location.js`。
4. 前端定位失败时保留手动选择位置兜底。

### 验收标准

- `frontend/pages/discover/input/input.js` 不出现 `restapi.amap.com`。
- 前端仓库不出现高德真实 key。
- 后端测试覆盖参数缺失、外部服务失败、成功返回三种情况。

---

## 5. P0-4 随机玩详情与转行程闭环

### 目标

随机玩结果页从“推荐卡片”升级为“推荐原因 + 详情展开 + 一键生成完整行程”的闭环。

### 涉及文件

修改：

- `frontend/pages/discover/result/result.js`
- `frontend/pages/discover/result/result.wxml`
- `frontend/pages/discover/result/result.wxss`
- `frontend/services/discover.js`
- `backend/src/routes/discover.js`
- `backend/src/services/discoverService.js`

新增或修改测试：

- `frontend/test/discover-flow.test.mjs`
- `backend/test/backend-contract.test.js`

### 实施要求

#### 5.1 推荐详情展开

`onViewDetail` 不再 `showToast("详情开发中")`，改为展开当前推荐卡片。

每个推荐卡片展开后至少展示：

- 推荐依据：距离、预算、偏好命中
- 适合人群：情侣、朋友、亲子、长辈等可选标签
- 风险提示：天气、人流、交通或预算不确定性
- 行程预览：Day 1 / Day 2 简要安排

如果后端暂时没有真实字段，后端可基于已有 `destination.tags`、`days`、`budget` 生成保守描述，但不能伪造评分、评论数或实时价格。

#### 5.2 推荐转行程

前端 `onGenerateTrip` 必须写入 `trip_params`，再跳转结果页：

```js
wx.setStorageSync('trip_params', {
  destinations: [
    {
      name,
      province,
      city: city || name,
      level: 'city'
    }
  ],
  start_date,
  days,
  preferences,
  extra_notes: `来自随机玩推荐：${name}`
});
wx.navigateTo({ url: '/pages/plan/result/result' });
```

不要只通过 URL query 传参，因为 `plan/result/result.js` 当前读取的是 `trip_params`、`trip_id` 或 `pre_generated_trip`。

#### 5.3 后端可选接口

保留或补齐文档中的接口：

```http
POST /api/discover/:destination_name/trip
```

该接口内部复用 `tripService.generate()`，不要复制行程生成逻辑。

### 验收标准

- 点击“查看详情”会展开卡片，不再出现“详情开发中”。
- 点击“生成行程”能进入结果页并触发真实行程生成。
- 随机玩生成的行程 `source` 应为 `discover`，或至少在 `extra_notes` 中可追踪来源。
- 前后端测试通过。

---

## 6. P0-5 API 响应与文档对齐

### 目标

新接口统一返回 `{ code, message, data }`；旧接口可以短期兼容，但文档必须反映真实路由。

### 涉及文件

修改：

- `backend/src/middleware/errorHandler.js`
- `backend/src/routes/*.js`
- `frontend/services/api.js`
- `docs/technical/API.md`

新增：

- `backend/src/utils/response.js`

### 实施要求

新增工具：

```js
export function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}
```

逐步用于：

- `/api/auth/login`
- `/api/location/regeo`
- `/api/discover/:destination_name/trip`

不要一次性强改所有既有接口，避免破坏前端兼容。前端 `services/api.js` 继续兼容旧响应：

- `{ code: 0, data }`
- `{ success: true, data }`
- 直接数组
- 直接对象

### 验收标准

- 新增接口均为统一格式。
- `docs/technical/API.md` 中城市接口路径与真实后端一致：
  - `GET /api/destinations/cities/:provinceCode`
  - `GET /api/destinations/districts/:cityCode`
- 后端契约测试覆盖新响应格式。

---

## 7. P1-1 行程可信字段增强

### 目标

行程结果不再只像 AI 文本，而是展示可验证的旅行信息。

### 涉及文件

修改：

- `backend/src/services/poiService.js`
- `backend/src/services/trip-generation/candidateService.js`
- `backend/src/services/trip-generation/skeletonBuilder.js`
- `backend/src/services/trip-generation/resultValidator.js`
- `backend/src/services/tripService.js`
- `backend/scripts/init.sql`
- `docs/technical/DATA_MODEL.md`
- `frontend/pages/plan/result/result.wxml`
- `frontend/pages/plan/result/result.wxss`

新增或修改测试：

- `backend/test/backend-contract.test.js`
- `frontend/test/trip-generation-state.test.mjs`

### 字段建议

行程项增加：

```json
{
  "source": "amap",
  "rating": 4.6,
  "review_count": 1284,
  "open_time": "09:00-18:00",
  "ticket_info": "免费 / 以现场为准",
  "last_verified_at": "2026-04-28",
  "confidence_level": "verified | estimated | ai_suggested"
}
```

注意：

- 如果字段来自高德或缓存，`confidence_level = "verified"`。
- 如果字段由规则估算，`confidence_level = "estimated"`。
- 如果字段由 AI 补充，`confidence_level = "ai_suggested"`，前端必须弱化展示。
- 不允许 AI 伪造评分、评论数、营业时间。

### 验收标准

- 每个 POI 至少展示来源、地址、时长或预算中的 3 类信息。
- 无真实评分时不显示评分，不写“暂无评分 5.0”。
- 兜底模板行程明确展示为“参考行程”或“可编辑行程”。

---

## 8. P1-2 UI 规范清理

### 目标

消除与 UI 规范冲突的 emoji 和粗糙占位符，让小程序更像可信工具，而不是临时 Demo。

### 涉及文件

修改：

- `frontend/pages/plan/result/result.wxml`
- `frontend/pages/plan/result/result.wxss`
- `frontend/pages/discover/input/input.wxml`
- `frontend/pages/discover/input/input.wxss`
- `frontend/pages/discover/result/result.wxml`
- `frontend/pages/discover/result/result.wxss`
- `frontend/assets/` 必要时新增本地图标

### 替换规则

| 当前 | 替换建议 |
|---|---|
| `📍` | `地址` 文本标签或本地 location 图标 |
| `💰` | `预算` 文本标签 |
| `🍜` | `菜系` / `推荐` 文本标签 |
| `⭐` | `亮点` / `评分` 文本标签 |
| `🕘` | `时间` 文本标签 |
| `⏱` | `时长` 文本标签 |
| `🎫` | `门票` 文本标签 |
| `🔍` | 搜索图标本地资源或纯 CSS 图形 |
| `[*]`、`[v]` | 正式文本或本地图标 |

### 设计要求

- 保持工具型信息清晰，避免大面积营销式 hero。
- 结果页以“路线清单/路书”为核心，不要过度卡片化。
- 所有按钮必须有 disabled/loading/active 状态。
- 文本不能溢出按钮或卡片。

### 验收标准

运行：

```powershell
Get-ChildItem -Recurse -File frontend |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  Select-String -Pattern '🔍|📍|💰|🍜|⭐|🕘|⏱|🎫'
```

结果应为空，或只出现在文档/注释中。

---

## 9. P1-3 用户反馈与基础埋点

### 目标

为 v2 个性化推荐准备数据，先记录用户对行程和推荐结果的明确反馈。

### 涉及文件

新增：

- `backend/src/routes/analytics.js`
- `backend/src/services/analyticsService.js`
- `frontend/services/analytics.js`

修改：

- `backend/src/index.js`
- `backend/scripts/init.sql`
- `docs/technical/DATA_MODEL.md`
- `frontend/pages/plan/result/result.js`
- `frontend/pages/discover/result/result.js`

### 数据表建议

```sql
CREATE TABLE IF NOT EXISTS user_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT DEFAULT '',
  event_type TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id TEXT DEFAULT '',
  payload TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

MySQL 版本按现有风格使用 `BIGINT UNSIGNED AUTO_INCREMENT`。

### 事件类型

| 事件 | 触发 |
|---|---|
| `trip_generate_success` | 行程生成成功 |
| `trip_generate_failed` | 行程生成失败 |
| `trip_save` | 保存行程 |
| `trip_copy` | 复制行程 |
| `trip_share` | 分享行程 |
| `trip_item_replace` | 替换行程项 |
| `trip_item_delete` | 删除行程项 |
| `discover_recommend_view` | 随机玩结果曝光 |
| `discover_detail_open` | 打开推荐详情 |
| `feedback_too_rushed` | 太赶 |
| `feedback_budget_mismatch` | 预算不符 |
| `feedback_not_interested` | 不感兴趣 |

### 验收标准

- 前端关键操作不会因埋点失败阻塞主流程。
- 后端支持 `POST /api/analytics/event`。
- 测试覆盖：未登录用户可上报匿名事件，已登录用户记录 openid。

---

## 10. 安全与人工处理事项

以下事项 Hermes 可以提示，但不应擅自完成：

1. 轮换 `backend/.env` 中已经出现过的高德、微信、AI 密钥。
2. 确认这些密钥是否进入过 Git 历史。
3. 配置生产域名与 HTTPS 证书。
4. 配置微信小程序合法请求域名。
5. 配置部署平台 Secret 管理。

Hermes 可以完成：

1. 确认 `.gitignore` 已忽略 `.env`。
2. 新增或更新 `.env.example`，只保留占位符。
3. 新增 `docs/DEPLOYMENT.md` 中的 Secret 配置说明。
4. 增加 secret 扫描建议命令。

---

## 11. 最终验收清单

### 功能验收

- [ ] 首页进入“行程规划”可完成目的地选择、参数填写、生成结果。
- [ ] 首页进入“随机玩”可完成位置、天数、预算、偏好选择。
- [ ] 随机玩推荐结果可展开详情。
- [ ] 随机玩推荐可一键转为完整行程。
- [ ] 行程结果可保存、复制、分享。
- [ ] 我的页面可查看已保存行程。
- [ ] 删除、备注、替换、排序不破坏本地展示与后端数据。

### 技术验收

- [ ] 前端页面业务代码没有硬编码 `http://localhost:3000`。
- [ ] 前端页面业务代码没有直接请求 `restapi.amap.com`。
- [ ] 新增接口使用统一响应格式。
- [ ] 前端 `services/api.js` 兼容旧响应格式。
- [ ] 后端测试通过。
- [ ] 前端测试通过。

### 设计验收

- [ ] 小程序界面没有 emoji 作为功能图标。
- [ ] 加载、空态、错误态都有明确文案。
- [ ] 结果页信息清晰，不用营销页式大面积装饰压过行程内容。
- [ ] 按钮和卡片文字不溢出。

### 安全验收

- [ ] 真实密钥不在新增代码和文档中出现。
- [ ] 前端没有暴露高德 Web API Key。
- [ ] `.env.example` 只使用占位符。
- [ ] 密钥轮换事项已向项目负责人确认。

---

## 12. 不做范围

本轮不要做以下事项，除非项目负责人另行确认：

1. 不接入真实酒店、机票、门票交易。
2. 不做小红书爬虫。
3. 不做社区 UGC 发布流。
4. 不做复杂协同过滤模型。
5. 不重构整个前端视觉系统。
6. 不迁移技术栈。

---

## 13. 推荐提交粒度

建议 Hermes 按以下提交拆分：

1. `fix(frontend): centralize api configuration`
2. `fix(auth): complete mini program login flow`
3. `fix(location): proxy reverse geocode through backend`
4. `feat(discover): complete detail and trip conversion flow`
5. `chore(api): align new responses and docs`
6. `feat(trip): show verified itinerary metadata`
7. `style(miniprogram): remove emoji placeholders from core pages`
8. `feat(analytics): record basic trip and discover events`

每个提交前运行对应测试。P0 全部完成后必须运行完整后端与前端测试。

