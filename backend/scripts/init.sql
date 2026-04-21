-- 旅游行程规划小程序数据库初始化脚本
-- 执行方式: mysql -u root -p < scripts/init.sql

CREATE DATABASE IF NOT EXISTS travel_planner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE travel_planner;

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `openid`        VARCHAR(64) NOT NULL UNIQUE COMMENT '微信 OpenID',
  `nickname`      VARCHAR(32) DEFAULT '' COMMENT '昵称',
  `avatar_url`    VARCHAR(512) DEFAULT '' COMMENT '头像 URL',
  `last_login_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 目的地基础表
CREATE TABLE IF NOT EXISTS `destination` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `name`         VARCHAR(64) NOT NULL COMMENT '名称',
  `province`     VARCHAR(32) NOT NULL COMMENT '所属省份',
  `city`         VARCHAR(32) NOT NULL COMMENT '所属城市',
  `district`     VARCHAR(32) DEFAULT '' COMMENT '所属区县',
  `adcode`       VARCHAR(16) NOT NULL COMMENT '高德行政区划编码',
  `latitude`     DECIMAL(10, 6) COMMENT '纬度',
  `longitude`    DECIMAL(11, 6) COMMENT '经度',
  `tier`         ENUM('hot', 'normal') DEFAULT 'normal' COMMENT '热门程度',
  `avg_budget`   DECIMAL(10, 2) COMMENT '人均消费参考',
  `source`       ENUM('admin', 'user', 'ai') DEFAULT 'admin' COMMENT '数据来源',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_adcode` (`adcode`),
  INDEX `idx_tier` (`tier`),
  INDEX `idx_province` (`province`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目的地基础表';

-- 目的地标签关联表
CREATE TABLE IF NOT EXISTS `destination_tag` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `destination_id`  BIGINT UNSIGNED NOT NULL COMMENT '目的地ID',
  `tag`             VARCHAR(32) NOT NULL COMMENT '标签',
  `weight`          TINYINT UNSIGNED DEFAULT 5 COMMENT '权重1-10',
  UNIQUE KEY `uk_dest_tag` (`destination_id`, `tag`),
  INDEX `idx_tag` (`tag`),
  FOREIGN KEY (`destination_id`) REFERENCES `destination`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='目的地标签关联表';

-- 行程表
CREATE TABLE IF NOT EXISTS `trip` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `title`         VARCHAR(128) NOT NULL COMMENT '行程标题',
  `destinations` JSON NOT NULL COMMENT '目的地列表',
  `start_date`    DATE NOT NULL COMMENT '出发日期',
  `days`          TINYINT UNSIGNED NOT NULL COMMENT '游玩天数',
  `preferences`   JSON NOT NULL COMMENT '游玩方式',
  `extra_notes`   VARCHAR(400) DEFAULT '' COMMENT '用户补充说明',
  `status`        ENUM('draft', 'published', 'archived') DEFAULT 'draft' COMMENT '状态',
  `source`        ENUM('plan', 'discover') NOT NULL COMMENT '来源',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程表';

-- 每日行程表
CREATE TABLE IF NOT EXISTS `trip_day` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `trip_id`      BIGINT UNSIGNED NOT NULL COMMENT '行程ID',
  `day_number`   TINYINT UNSIGNED NOT NULL COMMENT '第几天',
  `date`         DATE NOT NULL COMMENT '实际日期',
  `summary`      VARCHAR(256) DEFAULT '' COMMENT '当日总结',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_trip_day` (`trip_id`, `day_number`),
  INDEX `idx_trip_id` (`trip_id`),
  FOREIGN KEY (`trip_id`) REFERENCES `trip`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日行程表';

-- 行程单项表
CREATE TABLE IF NOT EXISTS `trip_item` (
  `id`                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `trip_day_id`       BIGINT UNSIGNED NOT NULL COMMENT '每日行程ID',
  `type`              ENUM('spot', 'food', 'hotel', 'transport') NOT NULL COMMENT '类型',
  `name`              VARCHAR(128) NOT NULL COMMENT '名称',
  `address`           VARCHAR(256) DEFAULT '' COMMENT '地址',
  `description`       VARCHAR(512) DEFAULT '' COMMENT '描述',
  `duration`          VARCHAR(32) DEFAULT '' COMMENT '建议时长',
  `budget`            VARCHAR(64) DEFAULT '' COMMENT '预算/消费',
  `recommend`         VARCHAR(256) DEFAULT '' COMMENT '推荐理由/推荐菜',
  `transport_to_next` VARCHAR(128) DEFAULT '' COMMENT '到下一项的交通',
  `poi_id`            VARCHAR(64) DEFAULT '' COMMENT '关联高德POI ID',
  `sort_order`        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序',
  `notes`             VARCHAR(256) DEFAULT '' COMMENT '用户备注',
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_trip_day_id` (`trip_day_id`),
  FOREIGN KEY (`trip_day_id`) REFERENCES `trip_day`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程单项表';

-- 用户偏好表
CREATE TABLE IF NOT EXISTS `user_preference` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `tag`          VARCHAR(32) NOT NULL COMMENT '偏好标签',
  `count`        INT UNSIGNED DEFAULT 1 COMMENT '命中次数',
  `last_used_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后命中时间',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_tag` (`user_id`, `tag`),
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户偏好表';

-- POI缓存表
CREATE TABLE IF NOT EXISTS `poi_cache` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `poi_id`       VARCHAR(64) NOT NULL COMMENT '高德POI ID',
  `destination`  VARCHAR(128) NOT NULL COMMENT '所属目的地关键词',
  `name`         VARCHAR(128) NOT NULL COMMENT '名称',
  `type`         ENUM('spot', 'food', 'hotel') NOT NULL COMMENT '类型',
  `data`         JSON NOT NULL COMMENT '完整POI数据',
  `cached_at`    DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '缓存时间',
  `expires_at`   DATETIME NOT NULL COMMENT '过期时间',
  UNIQUE KEY `uk_poi_id` (`poi_id`),
  INDEX `idx_destination` (`destination`),
  INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POI缓存表';

-- 行程模板表（AI兜底用）
CREATE TABLE IF NOT EXISTS `trip_template` (
  `id`           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
  `destination` VARCHAR(64) NOT NULL COMMENT '目的地名称',
  `days`         TINYINT UNSIGNED NOT NULL COMMENT '适用天数',
  `preferences`  VARCHAR(128) DEFAULT '' COMMENT '适用游玩方式',
  `content`      JSON NOT NULL COMMENT '模板内容',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_dest_days` (`destination`, `days`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行程模板表';

-- 行政区划数据表（由 init-region-data.js 填充）
CREATE TABLE IF NOT EXISTS `region_data` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code`       VARCHAR(16) NOT NULL COMMENT '行政区划代码',
  `name`       VARCHAR(64) NOT NULL COMMENT '名称',
  `level`      TINYINT NOT NULL COMMENT '1省 2市 3区县',
  `parent_code` VARCHAR(16) DEFAULT '' COMMENT '上级代码',
  `lat`        DECIMAL(10, 6) COMMENT '中心纬度',
  `lng`        DECIMAL(11, 6) COMMENT '中心经度',
  UNIQUE KEY `uk_code` (`code`),
  INDEX `idx_level` (`level`),
  INDEX `idx_parent` (`parent_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='行政区划数据表';
