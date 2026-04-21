// 用户服务
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

class UserService {
  getPool() {
    return mysql.createPool(config.db);
  }

  // 查找或创建用户
  async findOrCreateUser(openid) {
    const pool = this.getPool();
    const [rows] = await pool.query('SELECT * FROM `user` WHERE openid = ?', [openid]);

    if (rows.length > 0) {
      await pool.query('UPDATE `user` SET last_login_at = NOW() WHERE id = ?', [rows[0].id]);
      await pool.end();
      return { ...rows[0], created: false };
    }

    const [result] = await pool.query('INSERT INTO `user` (openid) VALUES (?)', [openid]);
    await pool.end();
    return { id: result.insertId, openid, created: true };
  }

  // 记录用户偏好
  async recordPreference(openid, { destinations, preferences, extra_notes }) {
    const pool = this.getPool();

    // 查找用户
    const [users] = await pool.query('SELECT id FROM `user` WHERE openid = ?', [openid]);
    if (users.length === 0) {
      await pool.end();
      return;
    }
    const userId = users[0].id;

    // 记录目的地偏好
    if (destinations) {
      for (const dest of destinations) {
        const name = typeof dest === 'string' ? dest : dest.name;
        await pool.query(
          `INSERT INTO user_preference (user_id, tag, count) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE count = count + 1, last_used_at = NOW()`,
          [userId, `dest:${name}`]
        );
      }
    }

    // 记录游玩方式偏好
    if (preferences) {
      for (const pref of preferences) {
        await pool.query(
          `INSERT INTO user_preference (user_id, tag, count) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE count = count + 1, last_used_at = NOW()`,
          [userId, pref]
        );
      }
    }

    // 记录关键词偏好
    if (extra_notes) {
      const keywords = extra_notes.split(/[,，、]/).filter(k => k.trim().length > 1);
      for (const kw of keywords) {
        await pool.query(
          `INSERT INTO user_preference (user_id, tag, count) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE count = count + 1, last_used_at = NOW()`,
          [userId, `kw:${kw.trim()}`]
        );
      }
    }

    await pool.end();
  }

  // 获取用户偏好
  async getUserPreferences(openid) {
    const pool = this.getPool();
    const [users] = await pool.query('SELECT id FROM `user` WHERE openid = ?', [openid]);
    if (users.length === 0) {
      await pool.end();
      return [];
    }

    const [prefs] = await pool.query(
      'SELECT tag, count, last_used_at FROM user_preference WHERE user_id = ? ORDER BY count DESC LIMIT 50',
      [users[0].id]
    );
    await pool.end();
    return prefs;
  }

  // 根据 openid 获取用户 ID
  async getUserIdByOpenid(openid) {
    const pool = this.getPool();
    const [rows] = await pool.query('SELECT id FROM `user` WHERE openid = ?', [openid]);
    await pool.end();
    return rows.length > 0 ? rows[0].id : null;
  }
}

export const userService = new UserService();
