// 数据库初始化与连接管理
// 支持 SQLite（默认，sqlite3 纯 JS）和 MySQL（DB_TYPE=mysql）
// 导出统一的 getDb() 接口，Service 层无感知

import path from 'path';
import { createRequire } from 'module';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);

// ─── SQLite 引擎（sqlite3 纯 JS）───────────────────────────────────────────

function createSqliteDb() {
  const sqlite3 = require('sqlite3').verbose();

  const dbPath = path.isAbsolute(config.db.path)
    ? config.db.path
    : path.resolve(process.cwd(), config.db.path);

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB] SQLite 连接失败:', err.message);
      process.exit(1);
    }
  });

  // 立即执行 pragma（无需 serialize，避免干扰后续查询）
  db.run('PRAGMA journal_mode = DELETE');
  db.run('PRAGMA foreign_keys = ON');

  // ── 接口封装 ────────────────────────────────────────────────────────────
  // sqlite3 npm 的 db.prepare().each() 在有 pending db.run() 时会返回 null，
  // 改用 db.all() 直接调用（更稳定）来替代 prepare().all/get/run。
  const wrapper = {
    /**
     * 查询多条记录
     * @param {string} sql
     * @param {...any} params
     * @returns {Promise<any[]>}
     */
    all(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.all(sql, ...params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },

    /**
     * 查询单条记录
     * @param {string} sql
     * @param {...any} params
     * @returns {Promise<any|null>}
     */
    get(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.get(sql, ...params, (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        });
      });
    },

    /**
     * 执行 INSERT/UPDATE/DELETE
     * @param {string} sql
     * @param {...any} params
     * @returns {Promise<{lastInsertRowid:number, changes:number}>}
     */
    run(sql, ...params) {
      return new Promise((resolve, reject) => {
        db.run(sql, ...params, function (err) {
          if (err) return reject(err);
          resolve({ lastInsertRowid: this.lastID, changes: this.changes });
        });
      });
    },

    /**
     * 执行多条 SQL（事务块内）
     * @param {string} sql
     * @returns {Promise<void>}
     */
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    /**
     * 事务块
     * sqlite3 npm 不支持同步事务，用 BEGIN/COMMIT 手动管理。
     * @param {Function} fn — async function receiving tx object
     */
    transaction(fn) {
      return async function wrappedTransaction(...callArgs) {
        await new Promise((resolve, reject) => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        try {
          const tx = {
            all(sql, ...params) {
              return new Promise((res, rej) => {
                db.all(sql, ...params, (err, rows) => {
                  if (err) return rej(err);
                  res(rows);
                });
              });
            },
            get(sql, ...params) {
              return new Promise((res, rej) => {
                db.get(sql, ...params, (err, row) => {
                  if (err) return rej(err);
                  res(row || null);
                });
              });
            },
            run(sql, ...params) {
              return new Promise((res, rej) => {
                db.run(sql, ...params, function (err) {
                  if (err) return rej(err);
                  res({ lastInsertRowid: this.lastID, changes: this.changes });
                });
              });
            }
          };
          const result = await fn(tx, ...callArgs);
          await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
          return result;
        } catch (e) {
          await new Promise((resolve) => {
            db.run('ROLLBACK', () => { resolve(); });
          });
          throw e;
        }
      };
    }
  };

    const _sqliteDb = {
      db,
      dbPath,
      // 直接方法（discoverService 等直接调 db.all/get/run/query）─────────
      all: (sql, ...params) => wrapper.all(sql, ...params),
      get: (sql, ...params) => wrapper.get(sql, ...params),
      run: (sql, ...params) => wrapper.run(sql, ...params),
      exec: wrapper.exec,
      transaction: wrapper.transaction,
      query: (sql, ...params) => wrapper.all(sql, ...params),
    };

  return _sqliteDb;
}

// ─── 数据库实例（统一接口）──────────────────────────────────────────────────

/** @type {any} 数据库实例 */
let _db;
/** @type {string} 日志用 */
let _connectedPath = '';

export async function initDatabase() {
  const dbType = config.db.type || 'sqlite';

  if (dbType === 'mysql') {
    // ── MySQL ──────────────────────────────────────────────────────────────
    let mysql;
    try {
      mysql = await import('mysql2/promise');
    } catch {
      console.error('[DB] mysql2 未安装，请运行: npm install mysql2');
      process.exit(1);
    }

    const pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port || 3306,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true
    });

    _db = {
      prepare(sql) {
        return {
          all(...params) {
            return pool.query(sql, params).then(([rows]) => rows);
          },
          get(...params) {
            return pool.query(sql, params).then(([rows]) => rows[0] || null);
          },
          run(...params) {
            return pool.query(sql, params).then(([result]) => ({
              lastInsertRowid: result.insertId,
              changes: result.affectedRows
            }));
          }
        };
      },
      exec(sql) {
        return pool.query(sql).then(([r]) => r);
      },
      transaction(fn) {
        return pool.getConnection().then((conn) => {
          return conn.beginTransaction().then(() => {
            const tx = {
              prepare(sql) {
                return {
                  all(...params) {
                    return conn.query(sql, params).then(([rows]) => rows);
                  },
                  get(...params) {
                    return conn.query(sql, params).then(([rows]) => rows[0] || null);
                  },
                  run(...params) {
                    return conn.query(sql, params).then(([result]) => ({
                      lastInsertRowid: result.insertId,
                      changes: result.affectedRows
                    }));
                  }
                };
              }
            };
            return fn(tx).then(
              (result) => conn.commit().then(() => conn.release()).then(() => result),
              (err) => conn.rollback().then(() => conn.release()).then(() => { throw err; })
            );
          });
        });
      }
    };

    _connectedPath = `${config.db.host}:${config.db.port}/${config.db.database}`;

  } else {
    // ── SQLite ─────────────────────────────────────────────────────────────
    const sqliteDb = createSqliteDb();
    _db = sqliteDb;
    _connectedPath = sqliteDb.dbPath;
  }

  // 初始化表结构
  initTables();
  console.log(`[DB] 已连接: ${_connectedPath} (${config.db.type || 'sqlite'})`);

  return _db;
}

function initTables() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE NOT NULL,
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS destination (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      level TEXT NOT NULL,
      parent_code TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      avg_budget REAL,
      hot_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS destination_tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (destination_id) REFERENCES destination(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS poi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gaode_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      type TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      rating REAL,
      price REAL,
      photos TEXT DEFAULT '[]',
      business_hours TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      destinations TEXT NOT NULL,
      start_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      preferences TEXT DEFAULT '[]',
      extra_notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      source TEXT DEFAULT 'plan',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trip_day (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      day_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      summary TEXT DEFAULT '',
      FOREIGN KEY (trip_id) REFERENCES trip(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trip_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_day_id INTEGER NOT NULL,
      type TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS user_preference (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      preference_type TEXT NOT NULL,
      value TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      UNIQUE(user_id, preference_type, value)
    );

    CREATE TABLE IF NOT EXISTS region_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      parent_code TEXT DEFAULT '',
      lat REAL,
      lng REAL
    );

    CREATE INDEX IF NOT EXISTS idx_destination_level ON destination(level);
    CREATE INDEX IF NOT EXISTS idx_destination_hot ON destination(hot_score DESC);
    CREATE INDEX IF NOT EXISTS idx_poi_city ON poi(city);
    CREATE INDEX IF NOT EXISTS idx_poi_type ON poi(type);
    CREATE INDEX IF NOT EXISTS idx_trip_user ON trip(user_id);
    CREATE INDEX IF NOT EXISTS idx_trip_day_trip ON trip_day(trip_id);
    CREATE INDEX IF NOT EXISTS idx_region_level ON region_data(level);
    CREATE INDEX IF NOT EXISTS idx_region_parent ON region_data(parent_code);
  `);

  console.log('[DB] 表结构初始化完成');
}

/**
 * 获取数据库实例
 * @returns {any} 兼容接口
 */
export function getDb() {
  if (!_db) {
    throw new Error('[DB] 数据库未初始化，请先调用 initDatabase()');
  }
  return _db;
}

// initDatabase 结束后 _db 已设置，重新导出所有 db 方法供其他模块 import
export const query = (...args) => _db.query(...args);
export const get = (...args) => _db.get(...args);
export const run = (...args) => _db.run(...args);
export const transaction = (...args) => _db.transaction(...args);
