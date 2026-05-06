# 微信小程序上传适配检查记录

检查日期：2026-04-30

参考文档：

- 微信开放文档：按需注入和用时注入
  https://developers.weixin.qq.com/miniprogram/dev/framework/ability/lazyload.html
- 微信开放社区：开发者工具上传代码质量优化项
  https://developers.weixin.qq.com/community/develop/doc/00040e5a0846706e893dcc24256009

## 1. 已完成适配

### 1.1 开启按需注入

状态：已完成

文件：

- `frontend/app.json`

配置：

```json
{
  "lazyCodeLoading": "requiredComponents"
}
```

说明：

微信上传质量要求建议开启组件按需注入。当前项目已经在 `app.json` 中加入该配置。

### 1.2 清理无依赖旧组件

状态：已完成

已移除：

- `frontend/components/loading-skeleton/`
- `frontend/components/region-picker/`
- `frontend/components/tag-selector/`

说明：

这些组件没有被任何页面 `usingComponents` 引用，属于旧实现残留。上传质量面板可能将其识别为无依赖文件，因此已清理。

### 1.3 移除无效 componentPlaceholder

状态：已完成

文件：

- `frontend/app.json`

说明：

原配置中存在 `region-picker`、`tag-selector` 的 `componentPlaceholder`，但当前项目没有对应自定义组件声明和实际使用。为避免无效配置影响按需注入效果，已删除。

### 1.4 上传压缩配置

状态：已满足

文件：

- `frontend/project.config.json`

当前配置：

```json
{
  "setting": {
    "minified": true,
    "minifyWXML": true,
    "minifyWXSS": true
  }
}
```

说明：

项目已开启 JS、WXML、WXSS 上传压缩相关配置。

### 1.5 包体与静态资源体积

状态：当前满足

检查结果：

- `frontend` 文件总量约 827KB，低于社区文档建议关注的 1.5MB 单包预警线。
- 当前图片资源单文件均低于 200KB。
- 当前超过 200KB 的文件为 `frontend/constants/region-data.js`，属于 JS 数据文件，不是图片或音频资源；但后续若地区数据继续增长，可考虑拆分或压缩。

## 2. 仍需在开发者工具中确认

以下项需要在微信开发者工具上传前确认：

1. 打开“详情 -> 本地设置”，确认“上传代码时自动压缩脚本文件”已开启。
2. 确认“上传代码时自动压缩 WXML 文件”已开启。
3. 确认“上传代码时自动压缩样式文件”已开启。
4. 打开“代码质量”面板，检查是否仍提示“无依赖文件”。
5. 如果代码质量面板提示误报，优先删除旧文件；确认为误报时再考虑 `packOptions.include`。

## 3. 后续 UI 升级注意事项

后续继续做 UI 大改时，需要遵守：

- 新增图片单文件尽量控制在 200KB 以下。
- 非必要大图不要放入代码包，可考虑 CDN。
- 新增自定义组件后，必须只在实际使用页面的 `usingComponents` 中声明。
- 不要把低使用率组件声明到 `app.json` 全局 `usingComponents`。
- 如果新增分包，再把仅分包使用的 JS、组件和资源移到对应分包。
- 如果使用 `componentPlaceholder`，必须保证对应组件真实存在且有页面使用。

## 4. 自动化检查

新增测试文件：

- `frontend/test/upload-compliance.test.mjs`

执行命令：

```powershell
cd D:\软件开发\旅游小程序\frontend
node --test test/upload-compliance.test.mjs
```

当前全量测试：

```powershell
node --test test/*.mjs
```

当前结果：42/42 通过。

