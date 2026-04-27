// 数据库抽象层 — queryBuilder
// 提供统一的 query/get/run/all/transaction 接口
// 支持 mysql2（生产）和 better-sqlite3（开发兼容）
// Service 层完全不感知底层引擎

import { getDb } from './database.js';

/**
 * 统一查询接口
 * @param {string} sql - SQL 语句，用 ? 占位
 * @param {Array} params - 参数数组
 * @returns {Array} 结果数组
 */
export function query(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * 查询单条
 * @param {string} sql
 * @param {Array} params
 * @returns {Object|null}
 */
export function get(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.get(...params) || null;
}

/**
 * 插入/更新/删除
 * @param {string} sql
 * @param {Array} params
 * @returns {{ lastInsertRowid: number, changes: number }}
 */
export function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * 查询全部（alias of query）
 */
export const all = query;

/**
 * 执行原始 SQL（DDL 等不带参数语句）
 * @param {string} sql
 */
export function exec(sql) {
  const db = getDb();
  db.exec(sql);
}

/**
 * 事务封装
 * @param {Function} fn - (transaction) => { ... }
 * 返回 fn 的执行结果
 */
export function transaction(fn) {
  const db = getDb();
  const tx = db.transaction(fn);
  return tx();
}

export default { query, get, run, all, exec, transaction };
