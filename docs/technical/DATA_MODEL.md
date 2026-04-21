# 数据模型文档

**版本：** v1.0
**日期：** 2026-04-21
**状态：** 已确认

---

## 一、数据库选型

| 场景 | 选型 | 说明 |
|---|---|---|
| 关系型数据 | MySQL 8.0 | 用户、行程、偏好等核心数据 |
| 缓存 | Redis 7 | 行政区划、POI 缓存、会话 |
| 文件存储 | 腾讯云 COS | 分享图片、用户上传 |

---

## 二、ER 图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │     Trip     │       │ Destination  │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │    ┌─▶│ id (PK)      │
│ openid       │  │    │ user_id (FK) │    │  │ name         │
│ nickname     │  │    │ destinations │    │  │ province     │
│ avatar_url   │  │    │ start_date   │    │  │ city         │
│ created_at   │  │    │ days         │    │  │ district     │
│ updated_at   │  │    │ preferences  │    │  │ latitude     │
└──────────────┘  │    │ created_at   │    │  │ longitude    │
                  │    │ status       │    │  │ tier (热门/  │  │
                  │    └──────────────┘    │  │      普通)   │  │
                  │                        │  └──────────────┘  │
                  │    ┌──────────────┐    │                    │
                  └───▶│ TripDay      │◀───┘                    │
                       ├──────────────┤      ┌──────────────┐   │
                       │ id (PK)      │      │ DestinationTag│   │
                       │ trip_id (FK) │      ├──────────────┤   │
                       │ day_number   │      │ destination_id│  │
                       │ date         │      │ tag           │   │
                       └──────────────┘      │ weight        │   │
                              │               └──────────────┘   │
                       ┌──────────────┐                           │
                       │  TripItem    │                           │
                       ├──────────────┤      ┌──────────────┐     │
                       │ id (PK)      │      │UserPreference│     │
                       │ trip_day_id  │      ├──────────────┤     │
                       │ type         │      │ id (PK)      │     │
                       │ name         │      │ user_id (FK) │     │
                       │ address      │      │ tag          │     │
                       │ description  │      │ count        │     │
                       │ duration     │      │ updated_at   │     │
                       │ budget       │      └──────────────┘     │
                       │ sort_order   │                           │
                       │ poi_id       │      ┌──────────────┐     │
                       │ notes        │      │ PoiCache      │     │
                       └──────────────┘      ├──────────────┤     │
                                              │ poi_id (PK) │     │
                                              │ destination │
                                              │ name        │     │
                                              │ type        │     │
                                              │ data (JSON) │     │
                                              │ cached_at   │     │
                                              └──────────────┘     │
```

---

## 三、表结构

### 3.1 用户表（User）

```sql
CREATE TABLE `user` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `openid`        VARCHAR(64) NOT NULL UNIQUE COMMENT '微信 OpenID',
  `nickname`      VARCHAR(32) DEFAULT '' COMMENT '昵称',
  `avatar_url`    VARCHAR(512) DEFAULT '' COMMENT '头像 URL',
  `last_login_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

### 3.2 行程表（Trip）

```sql
CREATE TABLE `trip` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT '用户 ID',
  `title`        VARCHAR(128) NOT NULL COMMENT '行程标题',
  `destinations` JSON NOT NULL COMMENT '目的地列表 [{name, province, city, district}]',
  `start_date`   DATE NOT NULL COMMENT '出发日期',
  `days`         TINYINT UNSIGNED NOT NULL COMMENT '游玩天数',
  `preferences`  JSON NOT NULL COMMENT '游玩方式 [字符串数组]',
  `extra_notes`  VARCHAR(400) DEFAULT '' COMMENT '用户补充说明',
  `status`       ENUM('draft', 'published', 'archived') DEFAULT 'draft' COMMENT '状态',
  `source`       ENUM('plan', 'discover') NOT NULL COMMENT '来源',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程表';
```

### 3.3 每日行程表（TripDay）

```sql
CREATE TABLE `trip_day` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `trip_id`      BIGINT UNSIGNED NOT NULL COMMENT '行程 ID',
  `day_number`   TINYINT UNSIGNED NOT NULL COMMENT '第几天（从1开始）',
  `date`         DATE NOT NULL COMMENT '实际日期',
  `summary`      VARCHAR(256) DEFAULT '' COMMENT '当日行程一句话总结',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_trip_day` (`trip_id`, `day_number`),
  INDEX `idx_trip_id` (`trip_id`),
  FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日行程表';
```

### 3.4 行程单项表（TripItem）

```sql
CREATE TABLE `trip_item` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `trip_day_id`  BIGINT UNSIGNED NOT NULL COMMENT '每日行程 ID',
  `type`         ENUM('spot', 'food', 'hotel', 'transport') NOT NULL COMMENT '类型',
  `name`         VARCHAR(128) NOT NULL COMMENT '名称',
  `address`      VARCHAR(256) DEFAULT '' COMMENT '地址',
  `description`  VARCHAR(512) DEFAULT '' COMMENT '描述',
  `duration`     VARCHAR(32) DEFAULT '' COMMENT '建议时长',
  `budget`       VARCHAR(64) DEFAULT '' COMMENT '预算/消费',
  `recommend`    VARCHAR(256) DEFAULT '' COMMENT '推荐理由/推荐菜',
  `transport_to_next` VARCHAR(128) DEFAULT '' COMMENT '到下一项的交通',
  `poi_id`       VARCHAR(64) DEFAULT '' COMMENT '关联高德 POI ID',
  `sort_order`   TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序',
  `notes`        VARCHAR(256) DEFAULT '' COMMENT '用户备注',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_trip_day_id` (`trip_day_id`),
  FOREIGN KEY (`trip_day_id`) REFERENCES `trip_day`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程单项表';
```

### 3.5 目的地基础表（Destination）

```sql
CREATE TABLE `destination` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `name`         VARCHAR(64) NOT NULL COMMENT '名称（景区/城市）',
  `province`     VARCHAR(32) NOT NULL COMMENT '所属省份',
  `city`         VARCHAR(32) NOT NULL COMMENT '所属城市',
  `district`     VARCHAR(32) DEFAULT '' COMMENT '所属区县（直辖市用）',
  `adcode`       VARCHAR(16) NOT NULL COMMENT '高德行政区划编码',
  `latitude`     DECIMAL(10, 6) COMMENT '纬度',
  `longitude`    DECIMAL(11, 6) COMMENT '经度',
  `tier`         ENUM('hot', 'normal') DEFAULT 'normal' COMMENT '热门程度',
  `avg_budget`   DECIMAL(10, 2) COMMENT '人均消费（参考）',
  `source`       ENUM('admin', 'user', 'ai') DEFAULT 'admin' COMMENT '数据来源',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_adcode` (`adcode`),
  INDEX `idx_tier` (`tier`),
  INDEX `idx_province` (`province`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目的地基础表';
```

### 3.6 目的地标签关联表（DestinationTag）

```sql
CREATE TABLE `destination_tag` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `destination_id` BIGINT UNSIGNED NOT NULL,
  `tag`          VARCHAR(32) NOT NULL COMMENT '标签：海滨/古镇/美食/亲子/文化/户外/购物',
  `weight`       TINYINT UNSIGNED DEFAULT 5 COMMENT '标签权重 1-10',
  UNIQUE KEY `uk_dest_tag` (`destination_id`, `tag`),
  INDEX `idx_tag` (`tag`),
  FOREIGN KEY (`destination_id`) REFERENCES `destination`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目的地标签关联表';
```

### 3.7 用户偏好表（UserPreference）

```sql
CREATE TABLE `user_preference` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `tag`          VARCHAR(32) NOT NULL COMMENT '偏好标签',
  `count`        INT UNSIGNED DEFAULT 1 COMMENT '命中次数',
  `last_used_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后命中时间',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_tag` (`user_id`, `tag`),
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户偏好表';
```

### 3.8 POI 缓存表（PoiCache）

```sql
CREATE TABLE `poi_cache` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `poi_id`       VARCHAR(64) NOT NULL COMMENT '高德 POI ID',
  `destination`  VARCHAR(128) NOT NULL COMMENT '所属目的地关键词',
  `name`         VARCHAR(128) NOT NULL COMMENT '名称',
  `type`         ENUM('spot', 'food', 'hotel') NOT NULL COMMENT '类型',
  `data`         JSON NOT NULL COMMENT '完整 POI 数据',
  `cached_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '缓存时间',
  `expires_at`   DATETIME NOT NULL COMMENT '过期时间',
  UNIQUE KEY `uk_poi_id` (`poi_id`),
  INDEX `idx_destination` (`destination`),
  INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POI 缓存表';
```

---

## 四、索引设计说明

| 表名 | 索引 | 类型 | 用途 |
|---|---|---|---|
| user | idx_openid | 普通 | OpenID 查询 |
| trip | idx_user_id | 普通 | 用户行程列表 |
| trip_day | idx_trip_id | 普通 | 行程日查询 |
| trip_item | idx_trip_day_id | 普通 | 日行程项查询 |
| destination | idx_tier | 普通 | 热门目的地筛选 |
| destination_tag | idx_tag | 普通 | 标签筛选目的地 |
| user_preference | idx_user_id | 普通 | 用户偏好查询 |
| poi_cache | idx_expires | 普通 | 缓存过期清理 |

---

## 五、数据类型说明

### 5.1 JSON 字段格式

**destinations（Trip 表）**
```json
[
  { "name": "成都市", "province": "四川省", "city": "成都市", "district": "" },
  { "name": "都江堰市", "province": "四川省", "city": "成都市", "district": "都江堰市" }
]
```

**preferences（Trip 表）**
```json
["轻松度假", "寻找美食"]
```

**data（PoiCache 表）**
```json
{
  "name": "宽窄巷子",
  "location": { "lat": 30.6698, "lng": 104.0563 },
  "address": "成都市青羊区长顺街附近",
  "tel": "028-xxxx",
  "rating": 4.5,
  "tag": "历史文化街区",
  "open_time": "全天开放",
  "price": 0
}
```

### 5.2 行政区划代码（adcode）参考

| 省份 | adcode 前缀 |
|---|---|
| 四川省 | 51 |
| 广东省 | 44 |
| 浙江省 | 33 |
| ... | ... |

---

## 六、数据初始化

### 6.1 行政区划数据

- 来源：民政部公开数据
- 格式：JSON，含省/市/区县三级
- 初始化脚本：`scripts/init-region-data.js`
- 执行时机：项目部署时执行一次，后续每年更新

### 6.2 目的地种子数据

- 预置 200 个热门旅游目的地
- 包含：经纬度、人均消费、标签
- 初始化脚本：`scripts/seed-content.js`
- 执行时机：首次部署时执行

### 6.3 POI 缓存策略

| POI 类型 | 缓存时间 | 说明 |
|---|---|---|
| 景点 | 7 天 | 变化少 |
| 餐厅 | 3 天 | 可能有新开业/歇业 |
| 酒店 | 1 天 | 价格经常变动 |
