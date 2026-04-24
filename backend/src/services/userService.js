// 用户服务
import { getDb } from '../db/database.js';

class UserService {
  get db() {
    return getDb();
  }

  // 通过 openid 获取用户
  getByOpenid(openid) {
    const stmt = this.db.prepare('SELECT * FROM user WHERE openid = ?');
    return stmt.get(openid);
  }

  // 获取用户 ID
  getUserIdByOpenid(openid) {
    const user = this.getByOpenid(openid);
    return user ? user.id : null;
  }

  // 创建或更新用户
  upsertUser(openid, userData = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO user (openid, nickname, avatar)
      VALUES (?, ?, ?)
      ON CONFLICT(openid) DO UPDATE SET
        nickname = excluded.nickname,
        avatar = excluded.avatar,
        updated_at = CURRENT_TIMESTAMP
    `);
    const result = stmt.run(openid, userData.nickname || '', userData.avatar || '');
    return result.lastInsertRowid;
  }

  // 获取用户偏好
  getPreferences(userId) {
    const stmt = this.db.prepare(
      'SELECT * FROM user_preference WHERE user_id = ? ORDER BY count DESC'
    );
    return stmt.all(userId);
  }

  // 更新偏好
  upsertPreference(userId, preferenceType, value) {
    const stmt = this.db.prepare(`
      INSERT INTO user_preference (user_id, preference_type, value, count, last_used)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, preference_type, value) DO UPDATE SET
        count = count + 1,
        last_used = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, preferenceType, value);
  }

  // 批量更新偏好
  upsertPreferences(userId, preferences) {
    const upsert = this.db.prepare(`
      INSERT INTO user_preference (user_id, preference_type, value, count, last_used)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, preference_type, value) DO UPDATE SET
        count = count + 1,
        last_used = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((items) => {
      for (const { type, value } of items) {
        upsert.run(userId, type, value);
      }
    });

    insertMany(preferences);
  }
}

export const userService = new UserService();
