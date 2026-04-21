# 部署文档

**版本：** v1.0
**日期：** 2026-04-21

---

## 一、环境准备

### 1.1 所需账户

| 服务 | 账户类型 | 用途 |
|---|---|---|
| 腾讯云 | 主账户 | 云函数、API 网关、MySQL、Redis |
| 微信公众平台 | 小程序账户 | AppID、审核发布 |
| 高德开放平台 | 个人开发者 | POI API Key |
| Claude API | 个人/团队 | AI 行程生成 |
| GitHub / Gitee | 个人 | 代码托管 |

### 1.2 服务器资源规划

| 环境 | 资源 | 规格 | 费用预估 |
|---|---|---|---|
| 生产 | 腾讯云 SCF | 函数计算，按调用量计费 | ~¥50/月 |
| 生产 | MySQL | 腾讯云 MySQL 基础版 | ~¥30/月 |
| 生产 | Redis | 腾讯云 Redis 基础版 | ~¥25/月 |
| 测试 | 同上共享 | 测试/预发布共用测试环境 | ¥0（使用免费额度） |

---

## 二、本地开发环境

### 2.1 前置依赖

| 工具 | 版本 | 安装方式 |
|---|---|---|
| Node.js | ≥ 20 LTS | [官网下载](https://nodejs.org/) |
| npm | ≥ 10 | 随 Node.js 一起安装 |
| 微信开发者工具 | 最新稳定版 | [官网下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) |

### 2.2 后端本地启动

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env
# 编辑 .env，填入各 API Key

# 启动开发服务器
npm run dev

# 服务运行在 http://localhost:3000
```

`.env.example` 内容：

```
NODE_ENV=development
PORT=3000

# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=travel_planner

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 高德地图
AMAP_KEY=your_amap_key
AMAP_SECRET=your_amap_secret

# AI 服务
AI_PROVIDER=claude
CLAUDE_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key

# 微信小程序
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
```

### 2.3 小程序本地调试

```bash
# 在微信开发者工具中：
# 1. 新建项目 → 选择 frontend/ 目录
# 2. 填入 AppID
# 3. 勾选"不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"
# 4. 打开调试器，在 Console 中验证
```

---

## 三、云端部署

### 3.1 数据库部署（腾讯云 MySQL）

**步骤 1：购买 MySQL 实例**

```
腾讯云控制台 → 云数据库 MySQL → 立即购买
规格：基础版，1核1GB（初期足够）
区域：广州或上海（就近）
```

**步骤 2：初始化数据库**

```sql
-- 连接到 MySQL 后执行：
CREATE DATABASE travel_planner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**步骤 3：初始化表结构**

```bash
cd backend
npm run db:migrate
# 或手动执行 sql/init.sql
```

**步骤 4：配置白名单**

在腾讯云 MySQL 控制台 → 白名单设置，添加云函数 IP 段（或 0.0.0.0/0 用于测试）。

---

### 3.2 Redis 部署（腾讯云 Redis）

```
腾讯云控制台 → 云数据库 Redis → 立即购买
规格：基础版，256MB（初期足够）
```

---

### 3.3 云函数部署（腾讯云 SCF）

**方式一：命令行部署（推荐）**

```bash
# 安装腾讯云 SCF CLI
npm install -g scf

# 配置腾讯云密钥
scf configure set --secretid YOUR_SECRET_ID --secretkey YOUR_SECRET_KEY --region ap-guangzhou

# 部署函数
cd backend
npm run deploy
```

**部署脚本（package.json scripts）：**

```json
{
  "scripts": {
    "deploy": "npm run build && scf deploy --function-name travel-api --handler index.handler --runtime Nodejs20 --memory 256 --timeout 30"
  }
}
```

**方式二：zip 包上传**

```bash
# 打包
npm run build
cd dist && zip -r ../deploy.zip . && cd ..

# 腾讯云 SCF 控制台 → 函数服务 → 创建函数 → 运行环境：Nodejs20 → 上传 zip
```

---

### 3.4 API 网关配置

在腾讯云 API 网关控制台：

1. **创建 API 网关服务**
2. **创建 API**
   - 请求路径：`/api/*`
   - 请求方法：ANY
   - 后端类型：云函数
   - 选择部署的云函数
3. **绑定域名**（可选，有默认域名）

**默认访问地址：**
```
https://service-xxxxxx.gz.apigw.tencentcs.com/release/
```

---

### 3.5 配置生产环境变量

在腾讯云 SCF 控制台 → 函数管理 → 函数配置 → 编辑，添加环境变量：

| 变量名 | 值 |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | MySQL 内网地址 |
| `DB_PORT` | `3306` |
| `DB_USER` | `travel_user` |
| `DB_PASSWORD` | `***` |
| `DB_NAME` | `travel_planner` |
| `REDIS_HOST` | Redis 内网地址 |
| `REDIS_PORT` | `6379` |
| `AMAP_KEY` | `***` |
| `AI_PROVIDER` | `claude` |
| `CLAUDE_API_KEY` | `***` |

---

## 四、微信小程序发布

### 4.1 配置合法域名

在[微信公众平台](https://mp.weixinadmin.com)后台：

```
开发 → 开发管理 → 服务器域名 → 添加 request 合法域名
```

| 域名 | 说明 |
|---|---|
| `https://api.travel.com` | 后端 API |
| `https://restapi.amap.com` | 高德地图 API |

### 4.2 上传代码

```bash
cd frontend

# 在微信开发者工具中：
# 1. 打开 frontend 目录
# 2. 点击"上传"按钮
# 3. 填写版本号和备注
```

### 4.3 提交审核

```
微信公众平台 → 管理 → 版本管理
→ 选择待审核版本 → 提交审核
→ 填写类目（旅游 > 行程服务）
→ 填写功能描述
→ 等待审核（1-7天）
```

### 4.4 审核通过后发布

审核通过后，在版本管理页面点击「发布」。

---

## 五、监控与告警

### 5.1 日志配置

腾讯云 SCF 提供日志功能，在云函数控制台 → 日志查询 中查看。

**关键日志：**
- AI 生成失败日志
- 高德 API 限流日志
- 数据库连接错误日志

### 5.2 告警规则

| 告警条件 | 触发动作 |
|---|---|
| 函数错误率 > 5% | 短信通知 + 钉钉机器人 |
| 函数内存使用 > 80% | 微信告警 |
| MySQL 连接数 > 80 | 数据库告警 |
| 高德 API 日调用量 > 4500 | 切换备用 Key |

### 5.3 巡检任务

| 任务 | 频率 | 内容 |
|---|---|---|
| 日志巡检 | 每日 | 统计 AI 生成成功率、错误类型分布 |
| 数据库巡检 | 每周 | 检查慢查询、连接数 |
| 缓存巡检 | 每周 | Redis 内存使用、命中率 |
| 域名到期检查 | 每月 | 确认域名续费 |

---

## 六、常见问题

### Q1: 云函数冷启动慢（首次调用 3-5s）

**解决方案：**
- 保持每日至少 1 次调用（定时触发器保活）
- 或升级函数规格（内存越大冷启动越快）

### Q2: 高德 API 每日额度不够用

**解决方案：**
- 多个 Key 轮询使用
- 申请企业认证提升额度
- 接入缓存策略（热门 POI 缓存 7 天）

### Q3: 小程序审核被拒绝

**常见原因：**
- 功能体验不完整（需提供真实可用的行程）
- 类目选择错误（选"旅游 > 行程服务"）
- 隐私协议未配置

**解决：** 确保提供的测试账号可完整走通流程，并在简介中清晰描述功能。

### Q4: 数据库连接失败

**排查步骤：**
1. 确认 MySQL 已启动
2. 确认云函数与 MySQL 在同一 VPC
3. 确认安全组已放行 3306 端口
4. 确认密码正确
