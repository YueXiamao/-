# 旅游行程规划小程序 - 项目索引

## 文档体系

| 文档 | 路径 | 说明 |
|---|---|---|
| 产品设计文档 | `planning/SPEC.md` | 功能范围、用户场景、产品逻辑 |
| 技术架构文档 | `docs/technical/ARCHITECTURE.md` | 系统分层、技术选型、部署架构 |
| 数据模型文档 | `docs/technical/DATA_MODEL.md` | 数据库设计、ER图、数据字典 |
| API 接口文档 | `docs/technical/API.md` | 所有接口的请求/响应格式 |
| AI 服务文档 | `docs/technical/AI_SERVICE.md` | Prompt 设计、生成逻辑、容错策略 |
| 小程序开发规范 | `docs/standards/MINI_PROGRAM.md` | 代码规范、组件规范、Git Flow |
| UI 设计规范 | `docs/ui-design/README.md` | 视觉规范、组件库、设计Token |
| 迭代路线图 | `planning/ROADMAP.md` | 各版本的里程碑和交付内容 |
| 部署文档 | `docs/DEPLOYMENT.md` | 环境配置、发布流程、监控告警 |

---

## 项目目录结构

```
travel-planner/
├── planning/                    # 开发计划与产品文档
│   ├── README.md
│   ├── SPEC.md                  # 产品设计规格书
│   └── ROADMAP.md               # 迭代路线图
├── docs/                        # 技术文档
│   ├── technical/
│   │   ├── ARCHITECTURE.md      # 技术架构
│   │   ├── DATA_MODEL.md        # 数据模型
│   │   ├── API.md               # API 接口文档
│   │   └── AI_SERVICE.md        # AI 服务设计
│   ├── ui-design/               # UI 设计规范资源
│   └── standards/
│       └── MINI_PROGRAM.md      # 小程序开发规范
├── backend/                     # 后端服务
│   ├── src/
│   │   ├── routes/              # 路由
│   │   ├── services/            # 业务逻辑
│   │   ├── models/             # 数据模型
│   │   ├── ai/                 # AI 生成模块
│   │   ├── crawler/            # 爬虫模块
│   │   └── utils/              # 工具函数
│   ├── config/                 # 配置文件
│   └── package.json
├── frontend/                    # 微信小程序前端
│   ├── pages/                  # 页面
│   ├── components/             # 公共组件
│   ├── utils/                  # 工具函数
│   ├── services/               # API 请求封装
│   ├── constants/              # 常量定义
│   └── assets/                 # 静态资源
├── data/                       # 静态数据
│   ├── region-data/            # 行政区划数据
│   ├── content-templates/      # 行程模板（AI兜底）
│   └── poi-cache/              # POI 缓存
├── scripts/                    # 工具脚本
│   ├── crawler/               # 爬虫脚本
│   └── data-process/          # 数据处理脚本
└── tests/                      # 测试
    ├── unit/
    └── integration/
```

---

## 快速导航（按开发阶段）

### 阶段一：基础设施搭建
1. 阅读 `planning/SPEC.md` 确认产品范围
2. 阅读 `docs/technical/ARCHITECTURE.md` 了解系统架构
3. 阅读 `docs/technical/DATA_MODEL.md` 了解数据结构
4. 搭建后端基础框架（参考 Architecture 文档）
5. 初始化小程序项目（参考 MINI_PROGRAM.md）

### 阶段二：核心功能开发
1. 行政区划数据接入（参考 DATA_MODEL.md）
2. 高德 API 接入（参考 API.md）
3. 行程生成逻辑开发（参考 AI_SERVICE.md）
4. 小程序各页面开发（参考 SPEC.md 功能章节）

### 阶段三：增强与优化
1. 个性化推荐（参考 ROADMAP.md v2.0）
2. 协同过滤（参考 ROADMAP.md v3.0）
3. 用户行为分析（参考 AI_SERVICE.md）

---

## 环境说明

| 环境 | 用途 | 说明 |
|---|---|---|
| 开发环境 | 本地开发 | `npm run dev` / 小程序开发者工具 |
| 测试环境 | 联调测试 | 独立的测试数据库和 API Key |
| 生产环境 | 正式上线 | 独立的生产数据库和 API Key |
