---
name: travel-app-pre-commit-check
description: 旅游小程序每次提交前必须执行的验证流程 — 防止改A坏B、孤儿文件、关键文件引用断裂
version: 1.0.0
---

# 旅游小程序 — 提交前检查清单

## 触发条件

**每次对 `frontend/` 或 `backend/` 下的 `.js` / `.wxml` / `.wxss` 文件做任何修改后，提交前必须执行本清单。**

## 执行流程

### Step 1：验证后端服务在线

```bash
curl -s --max-time 3 http://127.0.0.1:3001/health
# 期望：{"status":"ok","ts":...}
```

- ❌ 服务不通 → 先 `cd backend && PORT=3001 node src/index.js` 启动后端
- ✅ 返回 ok → 继续 Step 2

---

### Step 2：检查孤儿文件

修改/删除一个 JS 文件前，必须确认它没有被其他文件引用。

```bash
# 检查某文件是否被引用（替换 FILE_PATH）
grep -rl "文件名" frontend/pages/ backend/src/ --include="*.js" | grep -v "node_modules"
```

**规则：**
- 被引用 → 可以安全修改，不会影响其他模块
- **无引用且不在 `app.js` / `services/api.js` / `pages/*/result.js` 主流程 → 可能是孤儿，**先读文件内容确认**
- 被 `result.js` 引用 → 是核心模块，修改后必须自测该流程

---

### Step 3：验证关键文件链不断裂

本项目核心文件链（修改后必须验证对应功能）：

| 文件 | 影响范围 | 验证方法 |
|------|---------|---------|
| `app.js` | 全局初始化、登录 | 开发者工具控制台无报错 |
| `services/api.js` | 全部 HTTP 请求 | 任意 API 调用一次 |
| `services/auth.js` | 登录流程 | 触发 `wx.login()` 流程 |
| `services/login-gate.js` | 登录拦截 | 点击需要登录的按钮 |
| `pages/discover/input/input.js` | 随机玩参数收集 | 进入随机玩页面 |
| `pages/discover/result/result.js` | 随机玩结果展示 | 提交随机玩参数 |
| `pages/discover/result/plan-entry.js` | 随机玩→行程参数转换 | 点击「生成行程」 |
| `pages/plan/params/params.js` | 行程规划参数收集 | 进入行程规划页面 |
| `pages/plan/result/result.js` | 行程结果展示 | 提交行程规划 |
| `constants/index.js` | API 地址配置 | 任意 API 请求 |
| `backend/src/index.js` | 后端入口 | 健康检查 |
| `backend/src/routes/auth.js` | 登录路由 | `wx.login()` 完整流程 |

**修改后至少验证影响范围内的 1 个 API 调用成功（非超时/非后端未启动错误）。**

---

### Step 4：确保关键数据流不断

```
wx.login() → app.js ensureLogin() → openid 存储
discover/input → wx.setStorageSync('discover_params') → discover/result → wx.setStorageSync('trip_params') → plan/result
plan/params → wx.setStorageSync('trip_params') → plan/result
```

**修改 `storage` 相关的 key 名称后，必须全文搜索所有使用该 key 的文件是否同步更新。**

---

### Step 5：自测检查清单（开发者工具内）

| 功能 | 操作 | 期望结果 |
|------|------|---------|
| 自动登录 | 冷启动小程序 | 控制台 `[Auth] 登录成功` |
| 授权登录 | 点击需要登录的按钮 → 授权 | 流程正常完成，无弹窗报错 |
| 随机玩 | 选择条件 → 查看结果 → 生成行程 | 行程页正常展示 |
| 行程规划 | 填写参数 → 生成行程 | 行程页正常展示 |
| 定位 | 进入随机玩 → 获取位置 | 当前位置显示在地 |
| 后端连通 | 任意 API 调用 | 不报「后端服务未启动」或「请求超时」 |

---

### Step 6：Git 提交规范

```
<type>(<scope>): <描述>

【改动分类必填】（每次提交从以下选择一个）

【登录】auth.js/app.js 相关
【行程规划】plan/ 页面相关
【随机玩】discover/ 页面相关
【UI】app.wxss 或页面样式相关
【后端】backend/ 相关
【工具】constants/services 基础设施
【修复】Bugfix
【清理】删除废弃代码
```

**示例：**
```bash
git commit -m "fix(auth): app.js onLaunch 调用 ensureLogin(wx)

【登录】修复小程序冷启动时未自动换取 openid 的问题
- app.js: 移除旧 hydrateOpenid，改为调用 services/auth.js::ensureLogin(wx)
- 影响范围: 全局，所有需要登录的功能"
```

---

## 常见陷阱

### 1. 修改 `result.js` 后 `result.wxml` 绑定断裂
**症状**：页面空白或数据不显示  
**原因**：修改 `Page({ data: {...} })` 后 WXML 引用了不存在的字段  
**预防**：改完后用 `grep -n "data\." pages/xxx/result.wxml` 确认所有绑定字段在 JS 的 `data` 中

### 2. 修改 `params.js` 后 `trip_params` 结构变了
**症状**：`plan/result` 页面拿不到目的地/日期  
**原因**：`params.js` 写入 `trip_params` 的字段名变了  
**预防**：对比 `buildTripParams` 函数中返回的字段名与 `result.js` 中 `wx.getStorageSync('trip_params')` 的使用字段名

### 3. 修改 `constants/index.js` 后忘了更新 API URL
**症状**：开发者工具正常、真机报「后端服务未启动」  
**原因**：`API_TEST_URL` / `API_DEVTOOLS_URL` 只改了一个  
**预防**：检查所有 `API_*_URL` 常量同时更新

### 4. 删除文件后其他文件 import 报错
**症状**：`Third-party access error` 或页面直接白屏  
**原因**：删除了被其他 JS import 的工具文件  
**预防**：删除前先 `grep -rl "from.*文件名\|import.*文件名" frontend/`

---

## 本项目关键 constants（修改后特别注意）

```javascript
// frontend/constants/index.js
API_BASE_URL      // 生产环境（微信平台配置域名后使用）
API_TEST_URL      // 真机调试（当前: 192.168.3.37:3001）
API_DEVTOOLS_URL  // 开发者工具模拟器（当前: 127.0.0.1:3001）
```

```javascript
// 后端 .env
PORT=3001         // 后端监听端口（不再是 3000）
```
