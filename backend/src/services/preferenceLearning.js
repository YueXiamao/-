// 用户偏好学习服务
// 从用户反馈和行程操作中学习偏好，持续优化推荐质量
import { getDb } from '../db/database.js';

class PreferenceLearningService {
  get db() {
    return getDb();
  }

  /**
   * 写入或更新用户偏好（upsert）
   * @param {string} openid
   * @param {string} preferenceType - 偏好类型: pace|budget|poi_tag|commute|destination
   * @param {string} value - 偏好值
   * @param {number} weight - 本次权重（影响count增量）
   */
  upsertPreference(openid, preferenceType, value, weight = 1) {
    try {
      this.db.prepare(`
        INSERT INTO user_preference (user_id, preference_type, value, count, last_used)
        VALUES (
          (SELECT id FROM user WHERE openid = ?),
          ?, ?, ?,
          datetime('now')
        )
        ON CONFLICT(user_id, preference_type, value) DO UPDATE SET
          count = count + excluded.count,
          last_used = datetime('now')
      `).run(openid, preferenceType, value, weight);
    } catch (err) {
      // openid不在user表时静默失败（未登录用户）
      if (!err.message.includes('FOREIGN KEY')) {
        console.warn('[PreferenceLearning] upsert failed:', err.message);
      }
    }
  }

  /**
   * 读取用户所有偏好
   * @returns {{[preferenceType]: {value, count, last_used}[]}}
   */
  getPreferences(openid) {
    if (!openid) return {};
    try {
      const rows = this.db.prepare(`
        SELECT preference_type, value, count, last_used
        FROM user_preference
        WHERE user_id = (SELECT id FROM user WHERE openid = ?)
        ORDER BY count DESC
      `).all(openid);

      const result = {};
      for (const row of rows) {
        if (!result[row.preference_type]) result[row.preference_type] = [];
        result[row.preference_type].push({
          value: row.value,
          count: row.count,
          last_used: row.last_used
        });
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * 获取用户最高频的某类偏好值
   */
  getTopPreference(openid, preferenceType) {
    const prefs = this.getPreferences(openid);
    const list = prefs[preferenceType] || [];
    if (list.length === 0) return null;
    return list.reduce((a, b) => (a.count > b.count ? a : b)).value;
  }

  // ─── 反馈信号推断 ───────────────────────────────────────────────

  /**
   * 从负反馈推断并写入偏好
   * @param {string} openid
   * @param {string} feedbackType - too_rushed | budget_mismatch | not_interested | inaccurate | other
   * @param {object} payload - { reason, note, trip_id, ... }
   */
  inferFromFeedback(openid, feedbackType, payload = {}) {
    if (!openid) return;
    const weight = 3; // 反馈信号权重较高

    switch (feedbackType) {
      case 'too_rushed':
        // 行程太赶 → 偏好轻松
        this.upsertPreference(openid, 'pace', 'leisure', weight);
        break;

      case 'budget_mismatch':
        // 预算不符 → 偏好更经济/更奢侈
        this.upsertPreference(openid, 'budget', payload.budget || 'lower', weight);
        break;

      case 'not_interested':
        // 景点不感兴趣 → 标记该类型/标签
        if (payload.poi_type) {
          this.upsertPreference(openid, 'poi_tag', `dislike_${payload.poi_type}`, weight);
        }
        if (payload.reason) {
          this.upsertPreference(openid, 'poi_tag', `dislike_${payload.reason}`, weight);
        }
        break;

      case 'inaccurate':
        // 信息不准 → 偏好高质量POI
        this.upsertPreference(openid, 'poi_quality', 'high', weight);
        break;

      case 'other':
        if (payload.note) {
          this.upsertPreference(openid, 'feedback_other', payload.note.slice(0, 50), 1);
        }
        break;

      default:
        break;
    }
  }

  // ─── 替换操作信号推断 ────────────────────────────────────────────

  /**
   * 从行程项替换推断偏好
   * @param {string} openid
   * @param {object} oldItem - 被替换的POI项
   * @param {object} newItem - 替换后的新POI项
   * @param {object} options - { intent, ... }
   */
  inferFromReplace(openid, oldItem, newItem, options = {}) {
    if (!openid) return;
    const weight = 2;

    // intent 明确的替换
    if (options.intent) {
      switch (options.intent) {
        case 'nearer':
          this.upsertPreference(openid, 'commute', 'shorter', weight);
          break;
        case 'cheaper':
          this.upsertPreference(openid, 'budget', 'economical', weight);
          break;
        case 'indoor':
          this.upsertPreference(openid, 'poi_tag', 'indoor', weight);
          break;
        case 'family':
          this.upsertPreference(openid, 'poi_tag', 'family', weight);
          break;
        default:
          break;
      }
      return;
    }

    // 无intent时，从新旧POI差异推断
    // 类型变化：不喜欢旧类型
    if (oldItem.type && newItem.type && oldItem.type !== newItem.type) {
      this.upsertPreference(openid, 'poi_tag', `dislike_${oldItem.type}`, weight);
    }

    // 地点变化：新地点同区域加分
    if (oldItem.city && newItem.city && oldItem.city === newItem.city) {
      // 同一城市内替换，说明喜欢该城市
      this.upsertPreference(openid, 'destination', oldItem.city, weight);
    }

    // 价格变化推断预算偏好
    const oldPrice = parseFloat(oldItem.price || 0);
    const newPrice = parseFloat(newItem.price || 0);
    if (newPrice < oldPrice && newPrice > 0) {
      this.upsertPreference(openid, 'budget', 'economical', weight);
    } else if (newPrice > oldPrice) {
      this.upsertPreference(openid, 'budget', 'premium', weight);
    }
  }

  // ─── 推荐权重计算 ────────────────────────────────────────────────

  /**
   * 根据用户偏好计算推荐项的分数调整
   * @param {number} baseScore - 原始推荐分数
   * @param {object} destination - 目的地对象 { name, province, tags[], pace_label }
   * @param {string} openid
   * @returns {{ adjustedScore: number, reasons: string[] }}
   */
  applyPreferenceWeight(baseScore, destination, openid) {
    if (!openid) return { adjustedScore: baseScore, reasons: [] };

    const prefs = this.getPreferences(openid);
    let adjusted = baseScore;
    const reasons = [];

    // 1. pace 偏好
    const topPace = this.getTopPreference(openid, 'pace');
    if (topPace === 'leisure') {
      if (destination.pace_label === 'leisure') {
        adjusted += 15;
        reasons.push('适合轻松游');
      } else if (destination.pace_label === 'intense') {
        adjusted -= 10;
        reasons.push('节奏偏紧');
      }
    }

    // 2. poi_tag 排斥（不喜欢某类POI）
    const dislikeTags = (prefs.poi_tag || [])
      .filter(p => p.value.startsWith('dislike_'))
      .map(p => p.value.replace('dislike_', ''));
    if (dislikeTags.length > 0) {
      for (const tag of (destination.tags || [])) {
        if (dislikeTags.includes(tag)) {
          adjusted -= 20;
          reasons.push(`含有不喜欢的内容`);
          break;
        }
      }
    }

    // 3. poi_quality 偏好（要求高质量）
    const qualityPref = this.getTopPreference(openid, 'poi_quality');
    if (qualityPref === 'high') {
      adjusted += 5;
      reasons.push('精选高质量');
    }

    // 4. budget 偏好
    const topBudget = this.getTopPreference(openid, 'budget');
    if (topBudget === 'economical') {
      // 经济型用户，降低高消费目的地权重
      if ((destination.avg_cost || 0) > 500) {
        adjusted -= 10;
        reasons.push('消费较高');
      }
    } else if (topBudget === 'premium') {
      if ((destination.avg_cost || 0) < 200) {
        adjusted -= 5;
      }
    }

    return {
      adjustedScore: Math.max(0, Math.round(adjusted)),
      reasons
    };
  }
}

export const preferenceLearningService = new PreferenceLearningService();
