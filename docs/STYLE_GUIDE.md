# 前端样式规范

## 设计 Token

全局 token 定义在 `app.wxss` 的 `:root/page` 选择器下，所有页面必须引用 token，不得硬编码颜色/字号/间距。

| 类别 | token | 示例值 |
|------|-------|--------|
| 主色 | `--color-primary` | `#0D9C6E` |
| 辅色 | `--color-secondary` | `#E8810A` |
| 背景 | `--color-bg` | `#F2F5F1` |
| 文字 | `--color-text` | `#18181B` |
| 边框 | `--color-border` | `rgba(24,24,27,0.07)` |
| 危险 | `--color-danger` | `#DC2626` |
| 字号 | `--font-lg/--font-base/--font-sm` | `30/27/24rpx` |
| 间距 | `--sp-4/--sp-6/--sp-8` | `16/24/32rpx` |
| 圆角 | `--r-sm/--r-md/--r-lg` | `12/18/24rpx` |
| 阴影 | `--shadow-sm/--shadow-md` | rgba调色阴影 |

## 命名规范

### 页面结构类（必须）
```
page-bg         页面根容器
top-bar         顶部导航栏
content-wrap    内容区域
safe-bottom     底部安全区
```

### 卡片类（必须唯一，加模块前缀）
```
.card           ❌ 禁止（太通用）
.rec-card       ✅ 推荐（推荐卡片）
.trip-card      ✅ 推荐（行程卡片）
.dest-card      ✅ 推荐（目的地卡片）
```

### Section 类（表单/信息区块）
```
.section-card   表单/信息区块容器
.section-label  区块标签（kicker样式）
.section-hint   区块提示文字
```

### 组件状态类
```
.error-wrap     错误状态外层
.error-icon     错误图标
.loading-wrap   加载状态外层
.empty-wrap     空状态外层
.empty-icon     空状态图标
```

### 交互元素类
```
.btn-primary    主要按钮
.btn-secondary  次要按钮
.btn-ghost      幽灵按钮
.tag-*          标签（tag-green/tag-amber/tag-purple）
```

## 冲突类名清单

| 原名 | 位置 | 改为 |
|------|------|------|
| `.card` | plan/result.wxss | `.trip-card` |
| `.result` | plan/result.wxss | `.trip-result` |
| `.card` | discover/result.wxss | 已有 `.rec-card`，确认无冲突 |

## 颜色使用规则
- 所有颜色必须来自 token：`color: var(--color-primary)`
- 禁止出现：`color: #0D9C6E`、`color: #fff`、`background: #F2F5F1`
- 例外：调试临时样式（须附 TODO 并在提交前删除）

## Rpx vs Px
- 微信小程序布局用 `rpx`
- 字体/边框/阴影用 `rpx`
- 禁止混用 `px`
