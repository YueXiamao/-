-- MySQL 建表脚本（用于初始化 MySQL 数据库）
-- 运行方式：
--   mysql -u root -p travel_planner < scripts/mysql_schema.sql

CREATE DATABASE IF NOT EXISTS travel_planner
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE travel_planner;

-- 用户表
CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) UNIQUE NOT NULL COMMENT '微信 openid',
  nickname VARCHAR(64) DEFAULT '',
  avatar VARCHAR(512) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 目的地表
CREATE TABLE IF NOT EXISTS destination (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '目的地名称',
  province VARCHAR(64) NOT NULL COMMENT '所属省份',
  city VARCHAR(64) NOT NULL COMMENT '所属城市',
  level VARCHAR(16) NOT NULL COMMENT '级别：province/city/district',
  parent_code VARCHAR(32) DEFAULT '' COMMENT '上级行政区划代码',
  latitude DECIMAL(10, 6) DEFAULT NULL,
  longitude DECIMAL(11, 6) DEFAULT NULL,
  avg_budget DECIMAL(10, 2) DEFAULT NULL COMMENT '人均预算',
  hot_score INT DEFAULT 0 COMMENT '热度分',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_level (level),
  INDEX idx_hot (hot_score DESC),
  INDEX idx_province_city (province, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 目的地标签表
CREATE TABLE IF NOT EXISTS destination_tag (
  id INT AUTO_INCREMENT PRIMARY KEY,
  destination_id INT NOT NULL,
  tag VARCHAR(32) NOT NULL,
  FOREIGN KEY (destination_id) REFERENCES destination(id) ON DELETE CASCADE,
  INDEX idx_destination (destination_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POI 表
CREATE TABLE IF NOT EXISTS poi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gaode_id VARCHAR(32) UNIQUE NOT NULL COMMENT '高德地图 POI ID',
  name VARCHAR(256) NOT NULL COMMENT 'POI 名称',
  address VARCHAR(512) DEFAULT '' COMMENT '地址',
  type VARCHAR(32) NOT NULL COMMENT '类型：spot/food/hotel/shopping/transit',
  city VARCHAR(64) NOT NULL COMMENT '所在城市',
  latitude DECIMAL(10, 6) DEFAULT NULL,
  longitude DECIMAL(11, 6) DEFAULT NULL,
  rating DECIMAL(3, 2) DEFAULT NULL COMMENT '评分 0-5',
  price DECIMAL(10, 2) DEFAULT NULL COMMENT '价格',
  photos TEXT DEFAULT '[]' COMMENT '照片 JSON 数组',
  business_hours VARCHAR(128) DEFAULT '' COMMENT '营业时间',
  phone VARCHAR(32) DEFAULT '' COMMENT '电话',
  tags TEXT DEFAULT '[]' COMMENT '标签 JSON 数组',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_city (city),
  INDEX idx_type (type),
  INDEX idx_gaode_id (gaode_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 行程表
CREATE TABLE IF NOT EXISTS trip (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(256) NOT NULL COMMENT '行程标题',
  destinations TEXT NOT NULL COMMENT '目的地 JSON 数组',
  start_date DATE NOT NULL COMMENT '开始日期',
  days INT NOT NULL COMMENT '天数',
  preferences TEXT DEFAULT '[]' COMMENT '偏好标签 JSON 数组',
  extra_notes TEXT DEFAULT '' COMMENT '额外备注',
  status VARCHAR(16) DEFAULT 'draft' COMMENT '状态：draft/published',
  source VARCHAR(16) DEFAULT 'plan' COMMENT '来源：plan/discover',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 行程日程表
CREATE TABLE IF NOT EXISTS trip_day (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  day_number INT NOT NULL COMMENT '第几天',
  date DATE NOT NULL COMMENT '日期',
  summary TEXT DEFAULT '' COMMENT '日程摘要',
  FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE,
  INDEX idx_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 行程单项表
CREATE TABLE IF NOT EXISTS trip_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_day_id INT NOT NULL,
  type VARCHAR(16) NOT NULL COMMENT '类型：spot/food/hotel/shopping/transit',
  name VARCHAR(256) NOT NULL COMMENT '名称',
  address VARCHAR(512) DEFAULT '',
  description TEXT DEFAULT '',
  duration VARCHAR(32) DEFAULT '' COMMENT '游览时长',
  budget VARCHAR(32) DEFAULT '' COMMENT '预算',
  recommend VARCHAR(256) DEFAULT '' COMMENT '推荐理由',
  reason VARCHAR(256) DEFAULT '' COMMENT '替换原因',
  transport_to_next TEXT DEFAULT '' COMMENT '到下一站交通',
  notes TEXT DEFAULT '' COMMENT '用户备注',
  sort_order INT DEFAULT 0 COMMENT '排序',
  FOREIGN KEY (trip_day_id) REFERENCES trip_day(id) ON DELETE CASCADE,
  INDEX idx_day (trip_day_id),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户偏好表
CREATE TABLE IF NOT EXISTS user_preference (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  preference_type VARCHAR(32) NOT NULL COMMENT '偏好类型：destination/duration/budget/theme',
  value VARCHAR(64) NOT NULL COMMENT '偏好值',
  count INT DEFAULT 1 COMMENT '使用次数',
  last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_type_value (user_id, preference_type, value),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 行政区划表
CREATE TABLE IF NOT EXISTS region_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL COMMENT '行政区划代码',
  name VARCHAR(64) NOT NULL COMMENT '名称',
  level INT NOT NULL COMMENT '级别：1省/2市/3区县',
  parent_code VARCHAR(32) DEFAULT '' COMMENT '上级代码',
  lat DECIMAL(10, 6) DEFAULT NULL,
  lng DECIMAL(11, 6) DEFAULT NULL,
  INDEX idx_level (level),
  INDEX idx_parent (parent_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
