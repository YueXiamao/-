# 小程序收尾开发任务单

更新时间：2026-04-29  
适用对象：Codex / Hermes / 项目维护者  
目标：将当前项目从“功能基本可用”推进到“可稳定交付、可持续维护、可上线验收”

---

## 一、执行说明

本任务单按 `P0 / P1 / P2` 分级：

- `P0`：必须先完成，否则会直接影响稳定性、可用性或交付验收
- `P1`：高价值优化，直接提升体验、可维护性和性能
- `P2`：增强项，提升产品完成度和上线质量

每个任务均包含：

- `任务目标`
- `目标文件`
- `验收标准`
- `建议修改点`

建议执行顺序：

1. 先完成全部 `P0`
2. 再完成 `P1` 中的测试、清理、性能项
3. 最后完成 `P1` 视觉统一与 `P2` 增强项

---

## 二、P0 任务

### P0-01 主链路全量回归与验收记录

**任务目标**

对当前小程序两条核心链路做完整回归，确认不存在阻断使用的流程问题，并沉淀一份可复用验收记录。

**目标文件**

- `frontend/pages/index/index.*`
- `frontend/pages/plan/destination/*`
- `frontend/pages/plan/params/*`
- `frontend/pages/plan/result/*`
- `frontend/pages/discover/input/*`
- `frontend/pages/discover/result/*`
- `frontend/pages/profile/*`
- 新增：`docs/testing/MINIPROGRAM_E2E_CHECKLIST.md`

**验收标准**

- `首页 -> 行程规划 -> 生成行程 -> 保存 -> 我的 -> 再次打开` 全链路可走通
- `首页 -> 随机玩 -> 目的地推荐 -> 生成行程` 全链路可走通
- 无定位权限、后端未启动、请求超时、空推荐、保存失败等异常流均有正确反馈
- 形成勾选式验收文档，能作为后续回归基线

**建议修改点**

- 建立固定测试场景：单城市规划、多城市规划、随机玩推荐、已保存行程再次打开
- 对每个页面补“进入条件 / 成功条件 / 失败反馈”
- 将目前零散的测试结论汇总成一份正式文档

---

### P0-02 行程规划链路收口

**任务目标**

收口 `plan/destination`、`plan/params`、`plan/result` 三页的状态流转，避免旧数据串页、重复生成、参数丢失。

**目标文件**

- `frontend/pages/plan/destination/destination.js`
- `frontend/pages/plan/destination/destination.wxml`
- `frontend/pages/plan/destination/destination.wxss`
- `frontend/pages/plan/params/params.js`
- `frontend/pages/plan/result/result.js`
- `frontend/services/trip.js`

**验收标准**

- 从目的地选择进入参数页，再进入结果页时，参数完整且一致
- 重试生成不会产生重复状态污染
- 保存后再次打开同一行程，展示数据与保存结果一致
- 返回上一步后重新修改参数，不会误读旧缓存

**建议修改点**

- 明确 `trip_destinations`、`trip_params`、`pre_generated_trip`、`trip_id` 的优先级
- 检查 `navigateBack / navigateTo / switchTab` 后的状态复位
- 将结果页入口逻辑拆成更清晰的“新生成 / 读缓存 / 读详情”三类

---

### P0-03 随机玩链路收口

**任务目标**

确保 `discover/input` 与 `discover/result` 的输入、推荐、跳转行程三段链路稳定可用。

**目标文件**

- `frontend/pages/discover/input/input.js`
- `frontend/pages/discover/input/input.wxml`
- `frontend/pages/discover/input/input.wxss`
- `frontend/pages/discover/result/result.js`
- `frontend/pages/discover/result/result.wxml`
- `frontend/services/discover.js`
- `frontend/services/location.js`

**验收标准**

- 微信定位、手动选址两条路径都能正确进入推荐结果页
- 推荐为空、推荐失败、后端未启动时，界面反馈正确
- 点击“生成行程”后，参数传递正确，能进入规划结果页
- 不再存在无绑定 handler、废弃区县分支、无效 UI 状态

**建议修改点**

- 再做一次 `discover_params` 结构清查，统一字段命名
- 对推荐结果对象结构做防御式解析，避免后端字段缺失导致空白页
- 清理输入页与推荐页里遗留的旧结构、旧文案、旧注释

---

### P0-04 “我的行程”稳定性收口

**任务目标**

确保登录、列表加载、删除、再次进入页面等操作稳定可靠。

**目标文件**

- `frontend/pages/profile/profile.js`
- `frontend/pages/profile/profile.wxml`
- `frontend/pages/profile/profile.wxss`
- `frontend/services/auth.js`
- `frontend/services/trip.js`
- `frontend/app.js`

**验收标准**

- 首次进入页面不会重复登录、重复拉取列表
- 删除行程后列表能正确刷新
- 登录失败、列表拉取失败、无数据三种状态均可正确展示
- 页面从后台返回前台时，不会频繁重复请求

**建议修改点**

- 保持 `ensureLogin()` 为唯一登录入口
- 给 `loadTrips()` 增加 in-flight 防重保护
- 检查删除后是否需要做本地列表乐观更新，而不是一律重拉

---

### P0-05 统一错误处理与提示文案

**任务目标**

统一前端错误类型、用户提示语和异常页面展示，降低“每页说法不一样”的混乱感。

**目标文件**

- `frontend/services/api.js`
- `frontend/services/backend-health.js`
- `frontend/services/auth.js`
- `frontend/pages/plan/result/result.js`
- `frontend/pages/discover/result/result.js`
- `frontend/pages/profile/profile.js`
- 可新增：`frontend/constants/messages.js`

**验收标准**

- 同类错误（无网络、后端未启动、超时、参数缺失）只有一套提示语
- 错误提示与页面状态一致，不出现“后端未启动”误报
- 所有关键页面的 `loading / empty / error` 状态完整

**建议修改点**

- 抽离统一错误文案常量
- 将 toast、inline error、empty state 的使用边界明确下来
- 避免服务层和页面层重复拼接相近文案

---

### P0-06 上线前配置与环境检查

**任务目标**

确保开发、体验、正式环境下的 API、依赖和本地运行方式可控。

**目标文件**

- `frontend/constants/index.js`
- `frontend/services/api.js`
- `backend/package.json`
- `backend/src/config/index.js`
- `docs/DEPLOYMENT.md`
- 可新增：`docs/LOCAL_DEV_SETUP.md`

**验收标准**

- `release` 环境使用正式 API 地址
- 开发环境能明确指向本地后端地址
- 本地启动后端方式、Node 版本要求、端口要求在文档中写清楚
- 无测试地址、无临时调试开关、无敏感配置残留

**建议修改点**

- 统一环境切换逻辑，不要让页面层关心环境判断
- 明确后端必须使用 Node 20 的事实，并加入文档
- 将桌面启动脚本写入开发文档，便于交接

---

## 三、P1 任务

### P1-01 补齐核心页面测试

**任务目标**

将当前关键页面逻辑补上自动化测试，形成对后续修改的保护。

**目标文件**

- `frontend/test/api-auth-discover.test.mjs`
- `frontend/test/trip-backend-health.test.mjs`
- 新增：
  - `frontend/test/discover-input.test.mjs`
  - `frontend/test/profile-page.test.mjs`
  - `frontend/test/plan-result-flow.test.mjs`

**验收标准**

- 随机玩输入页选址链路有测试覆盖
- profile 登录/列表加载去重有测试覆盖
- 行程结果页生成/重试/保存至少覆盖关键状态切换
- `node --test test/*.mjs` 全通过

**建议修改点**

- 优先测纯逻辑与状态变更，不先上重 UI 测试
- 对 `storage`、`wx.request`、`wx.login` 做 mock 封装
- 将本轮修复过的问题优先固化成回归测试

---

### P1-02 页面与样式死代码清理

**任务目标**

清理当前代码库中已废弃、未引用、半残留的页面逻辑和样式，降低维护成本。

**目标文件**

- `frontend/pages/discover/input/*`
- `frontend/pages/plan/result/*`
- `frontend/pages/index/*`
- `frontend/app.wxss`
- `frontend/services/*`

**验收标准**

- 无无效 handler 绑定
- 无已删除功能对应的旧 UI 分支
- 无明显未使用样式块、旧注释、旧占位逻辑

**建议修改点**

- 对照 WXML 和 JS 做一次事件绑定扫描
- 对照 JS 和 WXSS 做一次类名引用扫描
- 清理旧英文标识、旧演示型占位文案

---

### P1-03 请求与缓存性能收口

**任务目标**

减少重复请求、无意义等待和大对象同步存储，改善页面体感速度。

**目标文件**

- `frontend/pages/profile/profile.js`
- `frontend/pages/plan/result/result.js`
- `frontend/pages/discover/result/result.js`
- `frontend/services/api.js`
- `frontend/services/trip.js`
- `frontend/services/discover.js`

**验收标准**

- 首屏不出现明显重复请求
- 不再有固定人为等待阻塞短请求
- 频繁使用的页面参数和结果集具备合理缓存策略
- 页面切换时无大对象反复读写导致的卡顿

**建议修改点**

- 对 `trip_params`、`discover_params`、`pre_generated_trip` 做生命周期梳理
- 对推荐结果、历史列表引入轻缓存与刷新策略
- 检查 `setData` 是否存在整块大对象频繁覆盖

---

### P1-04 行程结果页编辑体验完善

**任务目标**

将行程结果页的“替换 / 删除 / 备注 / 排序”能力收成一套更完整的编辑体验。

**目标文件**

- `frontend/pages/plan/result/result.js`
- `frontend/pages/plan/result/result.wxml`
- `frontend/pages/plan/result/result.wxss`

**验收标准**

- 用户能明确感知当前可编辑的能力边界
- 操作后反馈明确，不会出现“点了没反应”
- 保存前、保存后、只读详情三种状态的行为一致

**建议修改点**

- 将行内操作与顶部操作区分层
- 补备注入口或二级面板
- 视情况隐藏当前未完整支持的拖拽能力，避免半成品感

---

### P1-05 视觉统一收尾

**任务目标**

统一剩余页面的视觉结构，消除“新旧界面并存”的割裂感。

**目标文件**

- `frontend/pages/plan/destination/*`
- `frontend/pages/plan/params/*`
- `frontend/pages/discover/input/*`
- `frontend/app.wxss`

**验收标准**

- 标题、副标题、面板、按钮、底部栏采用同一套视觉语言
- 无残留英文按钮标识、演示型大字标签、旧式卡片
- 页面在小屏设备下无明显层级混乱或文字溢出

**建议修改点**

- 统一 header、page-hero、panel、action-strip 结构
- 统一信息卡的圆角、阴影、边框密度
- 对 `destination` 与 `params` 页做中文语义化收口

---

### P1-06 埋点与行为日志整理

**任务目标**

整理埋点命名、触发时机和字段结构，保证后续能用于真实分析。

**目标文件**

- `frontend/services/analytics.js`
- `frontend/pages/plan/result/result.js`
- `frontend/pages/discover/result/result.js`
- `frontend/pages/profile/profile.js`
- 可新增：`docs/technical/ANALYTICS_EVENTS.md`

**验收标准**

- 核心事件名、字段名统一
- 无重复埋点、无意义埋点
- 有一份事件清单文档可供后续接入分析平台

**建议修改点**

- 明确曝光、点击、成功、失败四类事件边界
- 用统一 payload 结构描述目标对象和上下文
- 记录当前未接平台前的离线缓存策略

---

## 四、P2 任务

### P2-01 “我的行程”增强

**任务目标**

提升“我的行程”页作为资产页的使用价值。

**目标文件**

- `frontend/pages/profile/profile.js`
- `frontend/pages/profile/profile.wxml`
- `frontend/pages/profile/profile.wxss`
- `frontend/services/trip.js`

**验收标准**

- 支持按更新时间或出发日期排序
- 支持按来源筛选：行程规划 / 随机玩
- 能显示最近查看或继续浏览信息

**建议修改点**

- 优先做前端筛选，后续如有必要再下沉到后端
- 排序/筛选入口应轻量，不要打断当前列表浏览

---

### P2-02 推荐解释能力增强

**任务目标**

让随机玩推荐不只是“给你结果”，还要说明“为什么是它”。

**目标文件**

- `frontend/pages/discover/result/result.wxml`
- `frontend/pages/discover/result/result.wxss`
- `frontend/pages/discover/result/result.js`
- `backend/src/routes/discover.js`
- `backend/src/services/discoverService.js`

**验收标准**

- 每个推荐项能展示更明确的匹配原因
- 用户能快速理解预算、距离、适合时长、偏好匹配度
- 推荐卡具备更强的横向比较能力

**建议修改点**

- 增加结构化字段而不是让前端纯拼文案
- 如无真实匹配分，可先用“适合原因”替代“评分”

---

### P2-03 轻缓存与继续上次使用

**任务目标**

提升回访效率，让用户能快速恢复上次操作上下文。

**目标文件**

- `frontend/pages/index/index.js`
- `frontend/pages/plan/params/params.js`
- `frontend/pages/discover/input/input.js`
- `frontend/services/*`

**验收标准**

- 可恢复最近一次规划参数
- 可恢复最近一次随机玩筛选条件
- 首页能提示“继续上次规划”或“最近浏览”

**建议修改点**

- 仅缓存必要字段，不缓存过大结果对象
- 为缓存增加有效期和来源标记

---

### P2-04 发布与交接文档整理

**任务目标**

补齐一线开发和上线交接所需文档。

**目标文件**

- `docs/DEPLOYMENT.md`
- `docs/LOCAL_DEV_SETUP.md`
- `docs/HERMES_AGENT_DEVELOPMENT_PLAN.md`
- 新增：
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/TROUBLESHOOTING.md`

**验收标准**

- 有本地开发启动说明
- 有后端启动与 Node 版本要求说明
- 有发布前检查清单
- 有常见问题排查说明

**建议修改点**

- 将“Node 20、127.0.0.1:3000、后端脚本”写成明确步骤
- 文档应服务于交接，不写泛泛说明

---

### P2-05 小屏适配与细节打磨

**任务目标**

在主要机型宽度下检查排版、底部栏、安全区和文案溢出问题。

**目标文件**

- `frontend/app.wxss`
- `frontend/pages/index/*`
- `frontend/pages/plan/*`
- `frontend/pages/discover/*`
- `frontend/pages/profile/*`

**验收标准**

- 常用手机宽度下无按钮被遮挡、文字溢出、底部栏压内容问题
- 安全区处理一致
- 空态、加载态、错误态视觉层级统一

**建议修改点**

- 重点检查 iPhone 标准宽度和小屏 Android
- 对长标题、长地名、长推荐文案做换行和截断策略

---

## 五、建议首批执行包

如果需要立即开工，建议先按下面这个执行包推进：

### 第一批（必须先做）

1. `P0-01` 主链路全量回归与验收记录  
2. `P0-02` 行程规划链路收口  
3. `P0-03` 随机玩链路收口  
4. `P0-04` “我的行程”稳定性收口  
5. `P0-05` 统一错误处理与提示文案  
6. `P1-01` 补齐核心页面测试  

### 第二批（高价值提升）

1. `P1-02` 页面与样式死代码清理  
2. `P1-03` 请求与缓存性能收口  
3. `P1-04` 行程结果页编辑体验完善  
4. `P1-05` 视觉统一收尾  

### 第三批（上线增强）

1. `P1-06` 埋点与行为日志整理  
2. `P2-01` “我的行程”增强  
3. `P2-04` 发布与交接文档整理  
4. `P2-05` 小屏适配与细节打磨  

---

## 六、完成定义（Definition of Done）

以下条件全部满足时，可认为项目收尾完成：

- 两条核心链路与关键异常流均验收通过
- 前端核心逻辑具备基础自动化测试保护
- 页面逻辑无明显废弃分支和重复请求
- 主界面视觉语言统一
- 环境配置、启动方式、发布步骤均有文档
- 可以交由非当前开发者继续维护与发布

