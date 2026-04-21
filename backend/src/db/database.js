// SQLite 数据库初始化与连接管理
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'travel.db');

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 开启 WAL 模式，提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化表结构
export function initDatabase() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE NOT NULL,
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 目的地表
    CREATE TABLE IF NOT EXISTS destination (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      level TEXT NOT NULL COMMENT 'province/city/district',
      parent_code TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      avg_budget REAL,
      hot_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 目的地标签关联表
    CREATE TABLE IF NOT EXISTS destination_tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (destination_id) REFERENCES destination(id) ON DELETE CASCADE
    );

    -- POI 表（高德地图数据缓存）
    CREATE TABLE IF NOT EXISTS poi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gaode_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      type TEXT NOT NULL COMMENT 'spot/food/hotel',
      city TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      rating REAL,
      price REAL,
      photos TEXT DEFAULT '[]' COMMENT 'JSON数组',
      business_hours TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      tags TEXT DEFAULT '[]' COMMENT 'JSON数组',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 行程表
    CREATE TABLE IF NOT EXISTS trip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      destinations TEXT NOT NULL COMMENT 'JSON数组',
      start_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      preferences TEXT DEFAULT '[]' COMMENT 'JSON数组',
      extra_notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' COMMENT 'draft/published',
      source TEXT DEFAULT 'plan' COMMENT 'plan/discover',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    -- 行程每日表
    CREATE TABLE IF NOT EXISTS trip_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      summary TEXT DEFAULT '',
      FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE
    );

    -- 行程单项表
    CREATE TABLE IF NOT EXISTS trip_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_day_id INTEGER NOT NULL,
      type TEXT NOT NULL COMMENT 'spot/food/hotel',
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      description TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      recommend TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      transport_to_next TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (trip_day_id) REFERENCES trip_day(id) ON DELETE CASCADE
    );

    -- 用户偏好表
    CREATE TABLE IF NOT EXISTS user_preference (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      preference_type TEXT NOT NULL COMMENT 'spot_type/food_type/budget',
      value TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      UNIQUE(user_id, preference_type, value)
    );

    -- 行政区划数据表
    CREATE TABLE IF NOT EXISTS region_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      level INTEGER NOT NULL COMMENT '1省 2市 3区县',
      parent_code TEXT DEFAULT '',
      lat REAL,
      lng REAL
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_destination_level ON destination(level);
    CREATE INDEX IF NOT EXISTS idx_destination_hot ON destination(hot_score DESC);
    CREATE INDEX IF NOT EXISTS idx_poi_city ON poi(city);
    CREATE INDEX IF NOT EXISTS idx_poi_type ON poi(type);
    CREATE INDEX IF NOT EXISTS idx_trip_user ON trip(user_id);
    CREATE INDEX IF NOT EXISTS idx_trip_day_trip ON trip_day(trip_id);
    CREATE INDEX IF NOT EXISTS idx_region_level ON region_data(level);
    CREATE INDEX IF NOT EXISTS idx_region_parent ON region_data(parent_code);
  `);

  console.log('✅ SQLite 数据库初始化完成:', dbPath);
  return db;
}

// 获取数据库实例
export function getDb() {
  return db;
}

export default db;
