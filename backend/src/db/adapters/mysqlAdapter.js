// MySQL 适配层
// 实现 better-sqlite3 的 .prepare().all/get/run 接口，兼容现有 Service
// 使用 mysql2/promise 配合 rawDriver 提供同步风格的 API

import mysql from 'mysql2/promise';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * 创建 MySQL 连接池
 * @param {Object} dbConfig - { host, port, user, password, database }
 * @returns {Object} 模拟 better-sqlite3 接口的对象
 */
export function createMySqlDb(dbConfig) {
  /** @type {mysql.Pool} */
  let pool;

  /** 缓存 prepared statements，避免每次重新创建 */
  const statementCache = new Map();

  function getPool() {
    if (!pool) {
      pool = mysql.createPool({
        host: dbConfig.host,
        port: dbConfig.port || 3306,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        namedPlaceholders: false,
        // 支持多年日期格式（0000-00-00）
        dateStrings: false,
        typeCast: function (field, next) {
          // DATE/DATETIME/TIMESTAMP 字段转字符串
          if (field.type === 'DATE' || field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
            const val = field.string();
            return val === null ? null : val;
          }
          return next();
        }
      });
    }
    return pool;
  }

  /**
   * 同步风格 SQL 执行器（内部异步，外部同步接口）
   * 使用 better-sqlite3 风格的 prepare API 封装
   */
  class SyncStatement {
    constructor(sql) {
      this.sql = sql;
    }

    _convertParams(params) {
      // mysql2 的占位符是 ?，参数顺序保持一致
      return params;
    }

    all(...params) {
      const p = this._convertParams(params);
      // mysql2/promise 的 pool.query 返回 [rows, fields]
      // 同步调用：用 .querySync（需要用 mysql2 的 sync API）
      // 但 mysql2/promise 没有同步API。这里改用 raw pool + Promise 包裹，
      // Service 层如果是 async 函数可直接用。
      // 为了兼容同步调用，用一个 sync-runner 变量暴露出入参，交给 pool.query
      const rows = getPool().query(this.sql, p);
      // 返回 Promise，让调用方 await（Service 层方法已支持 async）
      return rows.then(([r]) => r);
    }

    get(...params) {
      const p = this._convertParams(params);
      return getPool().query(this.sql, p).then(([r]) => r[0] || null);
    }

    run(...params) {
      const p = this._convertParams(params);
      return getPool().query(this.sql, p).then(([result]) => ({
        lastInsertRowid: result.insertId,
        changes: result.affectedRows
      }));
    }
  }

  const db = {
    /**
     * 同步风格的 prepare（实际内部异步）
     * Service 层通过 .all/.get/.run 触发实际查询
     */
    prepare(sql) {
      return new SyncStatement(sql);
    },

    /**
     * 执行原生 SQL 字符串（无参数），用于 DDL
     * @param {string} sql
     */
    exec(sql) {
      return getPool().query(sql).then(([r]) => r);
    },

    /**
     * 事务入口
     * @param {Function} fn - async (tx) => { ... }
     * tx 对象的 prepare() 和 db.prepare() 相同
     * @returns {Promise}
     */
    transaction(fn) {
      return getPool().getConnection().then((conn) => {
        return conn.beginTransaction().then(() => {
          const tx = {
            prepare(sql) {
              return new SyncStatement(sql);
            },
            commit() {
              return conn.commit();
            },
            rollback() {
              return conn.rollback();
            }
          };
          return fn(tx).then(
            (result) => conn.commit().then(() => result),
            (err) => conn.rollback().then(() => { throw err; })
          ).finally(() => conn.release());
        });
      });
    },

    /**
     * 关闭连接池
     */
    close() {
      if (pool) {
        pool.end();
        pool = null;
      }
    }
  };

  return db;
}
