# Hermes 界面优化设计与实施计划

> **给 Hermes agent 使用：** 执行本计划时必须使用 `web-design-engineer`。同时遵守项目 AGENTS.md 要求，在改动 UI 代码前应用 `design-taste-frontend`。

**目标：** 将当前微信小程序界面优化为统一、可信、清晰的旅行工具体验，并让 Hermes 可以按页面直接推进开发。

**架构原则：** 保持现有微信原生小程序技术栈不变。先围绕 `frontend/app.wxss` 中已有设计 token 统一视觉语言，再逐页重构 WXML/WXSS，不改路由，不重写应用。

**技术栈：** 微信小程序 WXML/WXSS/JS，本地 PNG 资源位于 `frontend/assets/`，不引入新的 UI 框架，不使用外部图标 CDN。

---

## 0. 设计意图

这个产品不是旅行社区、OTA 营销页，也不是内容流产品。它是一个实用型旅行规划工具。界面需要传达：

- **清晰：** 用户始终知道自己处在哪个规划步骤。
- **可信：** 生成的行程看起来可验证、可编辑，而不是一段自由发挥的 AI 文案。
- **轻旅行感：** 本地城市背景图负责氛围，但不能影响阅读。
- **移动端原生：** 控件适合单手操作，紧凑、稳定、可预期。
- **年轻但不吵：** 避免过度装饰、emoji 图标、霓虹渐变和夸张大首屏。

目标气质：**安静高级的路线规划工具**，更接近现代旅行实用工具，而不是生活方式信息流。

---

## 1. 当前 UI 诊断

### 1.1 需要保留的优点

| 领域 | 保留内容 |
|---|---|
| 全局 token | `frontend/app.wxss` 已定义色彩、字号、间距、圆角、阴影 |
| 旅行氛围 | 城市背景图和偏好 PNG 图标已本地化 |
| 主流程清晰度 | 首页已有两个明确入口 |
| 表单控件 | 日期、天数步进器、偏好网格已经容易理解 |
| 结果分组 | 行程结果页已经按天和类型组织 |

### 1.2 需要修复的问题

| 问题 | 现象 | 影响 |
|---|---|---|
| 类名体系不统一 | 部分 WXSS 使用 `hero-wrap/content-wrap`，WXML 使用 `page-hero` 或直接堆子节点 | 样式维护困难，部分样式可能未稳定命中 |
| 卡片过多 | 很多区块都是相似圆角和阴影的大卡片 | 内容显得沉，不像路线清单 |
| 结果页仍像 AI 文本 | POI 信息拆成很多 chip，且含 emoji 标签 | 降低可信度和扫描效率 |
| 仍有 emoji 与占位符 | `🔍`、`📍`、`💰`、`🍜`、`⭐`、`🕘`、`⏱`、`🎫`、`[*]`、`[v]` | 违反 UI 规范，看起来像 Demo |
| 随机玩页面不够统一 | 随机玩输入/结果页偏暖色、旧结构、顶部橙色条明显 | 产品像两个不同应用 |
| 状态不够精致 | 随机玩结果页使用 spinner，部分空态/错误态较粗糙 | 降低完成度 |
| 小屏可读性风险 | 结果页 item actions 和 metadata chips 容易挤压长名称 | 影响小屏触控和阅读 |

---

## 2. 设计决策

Hermes 必须把本节作为 UI 实施的视觉源头，除非用户给出更新方向。

### 2.1 色彩系统

沿用 `frontend/app.wxss` 中已有色彩，只做必要微调。

| Token | 角色 | 说明 |
|---|---|---|
| `--color-primary: #0D9C6E` | 主操作、行程规划流程、可信/完成状态 | 保留 |
| `--color-secondary: #E8810A` | 随机玩流程、预算、暖色提示 | 保留但克制使用 |
| `--color-bg: #F2F5F1` | 应用背景 | 保留 |
| `--color-surface: #FFFFFF` | 主要可读内容层 | 保留 |
| `--color-text: #18181B` | 主文字 | 保留 |
| `--color-text-secondary` | 辅助文字 | 保留 |
| `--color-danger` | 删除、危险操作 | 保留 |

不要新增更多主导色。不要扩大紫色使用。现有 `--color-purple` 只保留给住宿/酒店标签，若非必要，新 UI 不再扩展紫色场景。

### 2.2 字体层级

使用微信系统字体栈，不引入字体包。

| 场景 | 规格 |
|---|---|
| 页面标题 | `40-44rpx`，字重 800 |
| 区块标题 | `30-32rpx`，字重 750/800 |
| 正文 | `26-28rpx`，行高 1.55-1.7 |
| 元信息 / 标签 | `20-24rpx`，行高 1.4 |
| CTA 按钮 | `30rpx`，字重 700 |

除首页入口标题外，不要使用超过 `52rpx` 的展示字号。中文界面不要过度使用负字距，现有 `--tracking-tight` 已足够。

### 2.3 间距系统

沿用现有 token：

- 页面左右边距：`32rpx`
- 卡片内部边距：`24-32rpx`
- 区块间距：`20-24rpx`
- 紧凑列表行内边距：`22-28rpx`
- 固定底部 CTA 高度：`96-100rpx`

### 2.4 圆角策略

减少大圆角滥用：

| 组件 | 圆角 |
|---|---|
| 主卡片 | `--r-xl` |
| 内部行 / 控件 | `--r-md` |
| 标签 / chip | `--r-full` |
| 结果页时间线节点 | `--r-md` |

不要新增超过 `48rpx` 的视觉噱头圆角。

### 2.5 阴影层级

阴影只用于浮层控件和顶层卡片。

| 层级 | 使用场景 |
|---|---|
| 无阴影 | 行程结果 item 行、元信息行、列表分割 |
| `--shadow-xs/sm` | 小型交互行 |
| `--shadow-card` | 主要内容面板 |
| 固定底部阴影 | 底部 CTA |

结果页应减少卡片阴影，更多依赖分割线、时间线和间距来建立层级。

### 2.6 动效策略

微信小程序场景下，只使用 CSS transition。

- 按压反馈：`transform: scale(0.97-0.985)` 或 `translateY(2rpx)`
- 抽屉动画：保留现有 cubic transition
- 加载状态：列表内容使用 skeleton shimmer，少用 spinner
- 不动画 `top/left/width/height`
- 不增加长期运行的装饰动画，加载点和 skeleton 除外

---

## 3. 组件系统规范

Hermes 先在 `frontend/app.wxss` 中沉淀这些共享类，再逐页消费。

### 3.1 页面骨架

统一结构：

```xml
<view class="page page-bg" style="background-image: ...">
  <view class="page-hero">...</view>
  <view class="page-content">...</view>
  <view class="bottom-bar">...</view>
</view>
```

全局类：

- `.page`
- `.page-hero`
- `.page-content`
- `.page-title`
- `.page-kicker`
- `.page-subtitle`
- `.page-badges`
- `.page-badge`

### 3.2 内容面板

统一使用：

- `.surface-panel`：主要内容区块
- `.field-panel`：表单分组
- `.list-panel`：列表容器
- `.route-panel`：行程日程区块

避免卡片套卡片。如果一个区块已经在内容面板里，内部用分割线和留白，不再套新的阴影卡片。

### 3.3 元信息 chip

用文本标签替代 emoji：

```xml
<view class="meta-chip">
  <text class="meta-chip-label">时间</text>
  <text class="meta-chip-value">{{tripItem.best_time}}</text>
</view>
```

允许的标签：

- `时间`
- `时长`
- `门票`
- `地址`
- `预算`
- `推荐`
- `亮点`
- `来源`
- `评分`
- `交通`

### 3.4 状态区块

创建统一状态样式：

- `.state-block`
- `.state-mark`
- `.state-title`
- `.state-text`
- `.state-action`

用于 loading、empty、error。整页加载优先 skeleton 或阶段文案，不要只放一个 spinner。

### 3.5 底部操作栏

所有固定底部操作栏统一：

- 半透明白底
- `1rpx` 顶部分割线
- safe-area padding
- 一个主按钮，或主按钮 + 次按钮

按钮最小高度 `88rpx`，推荐 `96-100rpx`。

---

## 4. 页面级设计规格

## 4.1 首页

文件：

- `frontend/pages/index/index.wxml`
- `frontend/pages/index/index.wxss`

当前方向可保留，以优化为主，不做大改版。

### 必做改动

1. 如果页面显得过于泛 AI，可移除径向装饰光斑，只保留轻渐变背景。
2. 将 `PLAN` 和 `RND` 替换为更易懂的中文：
   - `规划`
   - `探索`
3. 入口标题更具体：
   - 行程规划：`已经想好目的地`
   - 随机玩：`还没决定去哪`
4. 所有入口标签在 320px 宽度手机上能自然换行，不挤压。
5. Footer 文案不要使用无依据承诺，例如“完全过滤广告”。建议替换为：
   - `围绕目的地、天数和偏好生成路线`
   - `随机玩会按位置、预算和天数筛选灵感`

### 验收标准

- 首屏能立即看到两个主入口。
- 没有虚假保证型文案。
- 入口卡片触控区域足够大，核心可点区域高度不低于 `88rpx`。

---

## 4.2 目的地选择页

文件：

- `frontend/pages/plan/destination/destination.wxml`
- `frontend/pages/plan/destination/destination.wxss`

### 必做改动

1. 对齐全局页面骨架：
   - 根节点：`.page page-bg`
   - Hero：`.page-hero`
   - 内容：`.page-content`
2. 保留城市背景图，但必须有可读的渐变遮罩。
3. 保留步骤条，但降低视觉重量：
   - 当前步骤数字为主色填充
   - 未完成步骤为描边
   - 连接线为 `1rpx` 或 `2rpx`
4. 搜索面板在概览之后优先展示。
5. 已选目的地标签展示：
   - 名称
   - 层级：`城市` / `区县`
   - 删除控件
6. 加载状态优先使用列表内 skeleton 行，减少独立“正在加载列表...”卡片。

### 验收标准

- 用户无需读长说明，也能知道当前处于省/市/区县哪一步。
- 点击下一步前，已选目的地始终可见。
- 搜索结果、省市区列表使用一致的行样式。

---

## 4.3 行程参数页

文件：

- `frontend/pages/plan/params/params.wxml`
- `frontend/pages/plan/params/params.wxss`

### 必做改动

1. 使用与目的地页一致的页面骨架。
2. 日期和天数保持两个紧凑面板。
3. 偏好网格继续 3 列，但必须：
   - 图片区域固定为 `112rpx x 112rpx`
   - 标签文字区域预留 2 行高度
   - 选中态不改变卡片尺寸
4. 文本框可以给示例，但 placeholder 不要过长。
5. 未选择偏好时，“生成行程”按钮应有明确 disabled 状态。

### 验收标准

- 选择偏好时不发生布局跳动。
- 长偏好标签不溢出。
- 键盘弹出时，底部 CTA 不遮挡正在输入的内容。

---

## 4.4 行程结果页

文件：

- `frontend/pages/plan/result/result.wxml`
- `frontend/pages/plan/result/result.wxss`
- `frontend/pages/plan/result/result.js`

这是本轮 UI 优化优先级最高的页面。

### 设计方向

让它像一张可执行路线单，而不是一堆 AI 卡片。

层级顺序：

1. 行程概要
2. 可信/降级提示
3. 操作按钮
4. Day 折叠区或 Day Tab
5. 路线项
6. 单项操作

### 必做改动

#### 头部

行程头部展示：

- 标题
- 日期和天数
- 目的地
- 偏好
- 如果是降级生成，展示质量提示 banner

头部应紧凑，不做大型装饰 hero。

#### 操作栏

当前操作栏可以保留，但样式更像按钮：

- `保存`
- `复制`
- `分享`

如果没有本地图标资源，不要用图标占位，直接使用清晰文字按钮。

#### Day 区块

每一天展示：

- `DAY 1`
- 日期
- 可选 summary
- 如果有数据，展示节奏标签：`轻松` / `适中` / `紧凑`

折叠态也要保留足够信息，方便扫描。

#### 路线项

使用时间线式结构：

```xml
<view class="route-item item-spot">
  <view class="route-rail">
    <text class="route-type">景</text>
  </view>
  <view class="route-body">
    <view class="route-head">
      <text class="route-name">{{tripItem.name}}</text>
      <text class="route-period">{{tripItem.period_label}}</text>
    </view>
    <view class="route-meta-grid">...</view>
    <view class="route-copy">...</view>
    <view class="route-actions">...</view>
  </view>
</view>
```

元信息不得使用 emoji。替换规则：

- `🕘 {{best_time}}` -> `时间 {{best_time}}`
- `⏱ {{duration}}` -> `时长 {{duration}}`
- `🎫 {{ticket_info}}` -> `门票 {{ticket_info}}`
- `📍 {{address}}` -> `地址 {{address}}`
- `💰 {{budget}}` -> `预算 {{budget}}`
- `🍜 {{cuisine_type}}` -> `菜系 {{cuisine_type}}`
- `⭐ {{highlights}}` -> `亮点 {{highlights}}`

#### 单项操作

尽量替换单字按钮：

- `换` -> `替换`
- `注` -> `备注`
- `删` -> `删除`

小屏幕允许换行。删除操作保持弱化，不要抢主视觉。

#### 加载状态

加载页展示阶段文案和 skeleton：

- `正在搜索地点`
- `正在安排路线`
- `正在补充细节`

不要只显示点状动画；尽量加入 Day skeleton 块。

### 验收标准

- 结果页无 emoji 元信息。
- 长 POI 名称可自然换行。
- 单项操作可点击，不与内容重叠。
- Day 折叠区像路线分段，不像营销卡片堆叠。

---

## 4.5 随机玩输入页

文件：

- `frontend/pages/discover/input/input.wxml`
- `frontend/pages/discover/input/input.wxss`

### 必做改动

1. 与计划页对齐，使用 `.page`、`.page-hero`、`.page-content`。
2. 保留暖色辅助色，但不要让橙色成为沉重顶部栏。
3. 替换占位符：
   - `[*]` -> CSS 定位标识或文字 `定位`
   - `[v]` -> 文字 `选择`
   - `🔍` -> CSS 搜索标识或文字 `搜索`
4. 位置卡片清楚展示：
   - 当前地址
   - 来源：`GPS` 或 `手动`
   - 两个操作：`使用定位`、`手动选择`
5. 预算卡片保持 2 列，且高度稳定。
6. 偏好卡片与行程参数页使用同一组件风格。

### 验收标准

- 随机玩输入页不再像旧版独立页面。
- 用户可单手完成填写。
- 位置选择抽屉有空态和加载态。

---

## 4.6 随机玩结果页

文件：

- `frontend/pages/discover/result/result.wxml`
- `frontend/pages/discover/result/result.wxss`
- `frontend/pages/discover/result/result.js`

### 设计方向

这个页面应像“三个可选的周末方向”，而不是普通排名列表。

### 必做改动

1. 移除 sticky 橙色顶部栏，改为普通页面 header：
   - 标题：`为你找到 {{recommendations.length}} 个方向`
   - 副标题：`按位置、预算和偏好筛选`
2. 推荐卡片结构：
   - 排名 badge 是小文字标签，不做悬浮奖牌
   - 目的地名称和省份
   - 推荐理由摘要
   - 匹配事实：距离、预算、天数、偏好标签
   - 预览路线统计
   - 操作：`看详情`、`生成行程`
3. 详情展开区包含：
   - `为什么适合`
   - `适合人群`
   - `注意事项`
   - `预览安排`
4. 加载态用推荐卡片 skeleton 替代 spinner。
5. 空态包含一个主操作：`重新选择条件`。

### 验收标准

- 排名不压过目的地内容。
- 展开详情可读，不形成卡片套卡片。
- 每张推荐卡底部操作按钮清晰可见。

---

## 4.7 我的页面

文件：

- `frontend/pages/profile/profile.wxml`
- `frontend/pages/profile/profile.wxss`

### 必做改动

1. 我的页保持轻量，不使用强背景图。
2. 用户卡片展示：
   - 头像字母或 `ME`
   - 用户状态
   - 登录提示
3. 只有在有数据时才展示偏好摘要：
   - 常用偏好
   - 最近目的地
4. 行程列表卡片更紧凑：
   - 标题
   - 日期/天数
   - 目的地
   - 来源
   - 删除操作
5. 空态更可行动：
   - 标题：`还没有保存行程`
   - 文案：`生成后点保存，就能在这里继续查看`
   - 按钮：`去规划`

### 验收标准

- 行程列表展示 5 条以上时不显得过度松散。
- 删除操作清晰，但不喧宾夺主。

---

## 5. 实施任务

### 任务 1：沉淀全局 UI 基础类

**文件：**

- 修改：`frontend/app.wxss`
- 如无必要，不改页面引入方式；微信小程序会自动应用全局样式。

**步骤：**

- [ ] 增加页面骨架类：`.page`、`.page-hero`、`.page-content`、`.page-kicker`、`.page-title`、`.page-subtitle`、`.page-badge`。
- [ ] 增加共享面板类：`.surface-panel`、`.field-panel`、`.list-panel`、`.route-panel`。
- [ ] 增加状态类：`.state-block`、`.state-mark`、`.state-title`、`.state-text`、`.state-action`。
- [ ] 增加元信息类：`.meta-chip`、`.meta-chip-label`、`.meta-chip-value`、`.meta-grid`。
- [ ] 增加按钮类：`.btn`、`.btn-primary`、`.btn-secondary`、`.btn-ghost`、`.btn-danger-text`。
- [ ] 检查是否与现有页面局部类冲突。

**验收：**

```powershell
cd frontend
node --test test/*.mjs
```

预期：全部通过。

---

### 任务 2：统一页面骨架

**文件：**

- 修改：`frontend/pages/plan/destination/destination.wxml`
- 修改：`frontend/pages/plan/destination/destination.wxss`
- 修改：`frontend/pages/plan/params/params.wxml`
- 修改：`frontend/pages/plan/params/params.wxss`
- 修改：`frontend/pages/discover/input/input.wxml`
- 修改：`frontend/pages/discover/input/input.wxss`

**步骤：**

- [ ] 根节点统一为 `.page page-bg` 或 `.page`。
- [ ] 页面主体内容统一包裹为 `.page-content`。
- [ ] 将页面专属 hero 命名替换为共享 `.page-hero` 类。
- [ ] 保留所有事件绑定和数据绑定。
- [ ] 手动检查 WXML 中是否有失效类名。

**验收：**

- 目的地页、参数页、随机玩输入页仍展示原有全部内容。
- 没有移除任何事件绑定。

---

### 任务 3：将行程结果页改造成路线单

**文件：**

- 修改：`frontend/pages/plan/result/result.wxml`
- 修改：`frontend/pages/plan/result/result.wxss`
- 必要时修改：`frontend/pages/plan/result/result.js`

**步骤：**

- [ ] 将 emoji 元信息全部替换为文本 label/value chip。
- [ ] 将行程项 markup 重构为路线/时间线结构。
- [ ] 保留行程项操作：替换、备注、删除。
- [ ] 保留 Day 展开/收起行为。
- [ ] 用共享状态类优化 loading 和 error。
- [ ] 确保降级生成 banner 仍可见。

**验收：**

运行：

```powershell
Get-ChildItem -Recurse -File frontend/pages/plan/result |
  Select-String -Pattern '📍|💰|🍜|⭐|🕘|⏱|🎫'
```

预期：无匹配。

---

### 任务 4：重设计随机玩结果页

**文件：**

- 修改：`frontend/pages/discover/result/result.wxml`
- 修改：`frontend/pages/discover/result/result.wxss`
- 修改：`frontend/pages/discover/result/result.js`

**步骤：**

- [ ] 用页面 hero 替换 sticky 橙色顶部栏。
- [ ] 将排名 badge 改成小型文本标签。
- [ ] 增加详情展开区样式。
- [ ] 用 skeleton 推荐卡片替换 spinner loading。
- [ ] 保留 `onViewDetail`、`onGenerateTrip`、`onRetry`、`onBack` 事件绑定。
- [ ] 确保新详情区能配合 `docs/HERMES_AGENT_DEVELOPMENT_PLAN.md` 中 P0-4 的逻辑实现。

**验收：**

- 如果逻辑已实现，`查看详情` 可以展开/收起详情。
- 空态有明确的 `重新选择条件` 操作。

---

### 任务 5：清理随机玩输入页符号与抽屉

**文件：**

- 修改：`frontend/pages/discover/input/input.wxml`
- 修改：`frontend/pages/discover/input/input.wxss`

**步骤：**

- [ ] 将 `[*]`、`[v]`、`🔍` 替换为 CSS 或文本方案。
- [ ] 如果已有加载状态数据，增加抽屉 loading 样式；否则至少完善空态。
- [ ] 确保位置、天数、预算、偏好区块与行程参数页风格一致。
- [ ] 保留 GPS/手动选择行为。

**验收：**

```powershell
Get-ChildItem -Recurse -File frontend/pages/discover |
  Select-String -Pattern '🔍|\[\*\]|\[v\]'
```

预期：运行时 WXML 中无匹配。

---

### 任务 6：首页与我的页面文案/密度优化

**文件：**

- 修改：`frontend/pages/index/index.wxml`
- 修改：`frontend/pages/index/index.wxss`
- 修改：`frontend/pages/profile/profile.wxml`
- 修改：`frontend/pages/profile/profile.wxss`

**步骤：**

- [ ] 替换“完全过滤广告”等高风险承诺。
- [ ] 首页入口标签改为用户更容易理解的中文。
- [ ] 收紧我的页面行程列表密度。
- [ ] 优化空态文案。
- [ ] 保留导航与删除事件绑定。

**验收：**

- 首页首屏仍展示两个主入口。
- 我的页面空态能清楚说明保存后的行程会出现在哪里。

---

### 任务 7：视觉 QA

**文件：**

- 所有被改动的 WXML/WXSS 文件。

**步骤：**

- [ ] 搜索 emoji 和占位符。
- [ ] 检查是否有明显卡片套卡片结构。
- [ ] 检查偏好网格中的长中文标签。
- [ ] 检查固定底部栏是否遮挡页面最后内容。
- [ ] 使用微信开发者工具或可用预览环境检查：
  - iPhone SE 宽度
  - 常见 iPhone 宽度
  - 大屏 Android 宽度

**验收命令：**

```powershell
cd frontend
node --test test/*.mjs
```

```powershell
Get-ChildItem -Recurse -File frontend |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  Select-String -Pattern '🔍|📍|💰|🍜|⭐|🕘|⏱|🎫|\[\*\]|\[v\]'
```

预期：测试通过；运行时 WXML/JS/WXSS 中没有 UI 符号匹配。

---

## 6. 文案规范

使用具体、克制的中文文案。避免泛泛承诺。

### 推荐文案

| 场景 | 文案 |
|---|---|
| 首页行程规划标题 | `已经想好目的地` |
| 首页随机玩标题 | `还没决定去哪` |
| 行程规划说明 | `把目的地、天数和偏好整理成可执行路线` |
| 随机玩说明 | `按位置、预算和天数筛选周末灵感` |
| 结果页降级提示 | `这是一份可编辑参考行程，建议出发前确认营业时间和票务信息` |
| 我的页空态 | `生成后点保存，就能在这里继续查看` |

### 避免文案

- `完全过滤广告`
- `马上出攻略`
- `真实好玩`
- `一键搞定所有旅行问题`
- 任何关于实时价格、库存、营业时间的保证，除非有已验证数据支持

---

## 7. 资产规范

只使用 `frontend/assets/` 下的本地资源。

现有资产目录：

- `frontend/assets/backgrounds/`
- `frontend/assets/icons/`
- `frontend/assets/pref-icons/`

如 Hermes 需要新增图标：

1. 优先使用 CSS 或文字标签。
2. 确实需要视觉图标时，新增简单 PNG 到 `frontend/assets/icons/`。
3. 不使用 emoji。
4. 不热链外部图片。
5. 除非项目已有同类组件，不新增复杂 SVG 插画。

---

## 8. 交互要求

### 8.1 控件状态

每个交互控件至少需要：

- default
- active 按压态
- disabled（如果操作可能不可用）
- loading（如果触发网络或生成）

### 8.2 页面状态

每个主要数据页都需要：

- loading
- empty
- error
- success

适用页面：

- 目的地列表
- 随机玩推荐列表
- 行程生成结果
- 我的行程列表

---

## 9. 禁止事项

Hermes 在本轮 UI 优化中不得做以下事情：

1. 不迁移到 React/Vue/Taro/uni-app。
2. 不添加 Tailwind 或第三方 UI 库。
3. 不引入 Web 字体。
4. 不使用远程图片 URL。
5. 不新增阻碍用户直接使用工具的大型装饰首屏。
6. 除 `docs/HERMES_AGENT_DEVELOPMENT_PLAN.md` 要求外，不修改 API 契约。
7. 重构 WXML 时不得移除现有事件处理。
8. 不把路线内容埋进多层嵌套卡片。

---

## 10. 最终完成定义

UI 优化完成需满足：

- [ ] 所有主要页面共享一致的页面骨架和间距节奏。
- [ ] 首页、规划、随机玩、结果、我的页面看起来属于同一个产品。
- [ ] 行程结果页像一份可执行路线单。
- [ ] 随机玩结果页解释“为什么适合”，而不仅是排名。
- [ ] 运行时 UI 中没有 emoji 或占位符符号。
- [ ] 加载、空态、错误态精致且明确。
- [ ] 固定底部栏尊重 safe area，不遮挡内容。
- [ ] `frontend` 测试通过。
- [ ] 实现仍保持微信原生小程序代码。

