// 随机玩推荐服务
import { getDb } from '../db/database.js';

class DiscoverService {
  get db() {
    return getDb();
  }

  // Haversine 距离
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  maxDistanceByDays(days) {
    if (days === 1) return 100;
    if (days === 2) return 300;
    if (days <= 4) return 800;
    return 2000;
  }

  budgetToRange(budget) {
    const map = {
      '500以下': [0, 500],
      '500-1000': [500, 1000],
      '1000-2000': [1000, 2000],
      '2000-5000': [2000, 5000],
      '5000以上': [5000, Infinity]
    };
    return map[budget] || [0, 2000];
  }

  // 推荐目的地
  async recommend({ current_location, days, budget, preferences }) {
    const { latitude, longitude, city } = current_location;
    const pool = this.db;

    const [minBudget, maxBudget] = this.budgetToRange(budget);
    const maxDist = this.maxDistanceByDays(days);

    let candidates;
    if (latitude && longitude) {
      // 有坐标，从数据库取所有目的地按距离筛选
      candidates = pool.prepare(
        `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
         FROM destination d
         LEFT JOIN destination_tag dt ON d.id = dt.destination_id
         GROUP BY d.id`
      ).all();
    } else {
      // 无坐标，按城市名匹配
      const q = city ? `%${city}%` : '%';
      candidates = pool.prepare(
        `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
         FROM destination d
         LEFT JOIN destination_tag dt ON d.id = dt.destination_id
         WHERE d.city LIKE ? OR d.name LIKE ?
         GROUP BY d.id`
      ).all(q, q);
    }

    const scored = [];

    for (const dest of candidates) {
      if (latitude && longitude && dest.latitude && dest.longitude) {
        const dist = this.haversineDistance(
          latitude, longitude, parseFloat(dest.latitude), parseFloat(dest.longitude)
        );
        if (dist > maxDist) continue;
      }

      if (dest.avg_budget && (dest.avg_budget < minBudget || dest.avg_budget > maxBudget)) {
        continue;
      }

      const tags = dest.tags ? dest.tags.split(',') : [];
      const prefMatch = preferences?.length > 0
        ? tags.filter(t => preferences.includes(t)).length / preferences.length
        : 0.5;

      const distScore = (latitude && longitude && dest.latitude)
        ? 1 - (this.haversineDistance(latitude, longitude, parseFloat(dest.latitude), parseFloat(dest.longitude)) / maxDist)
        : 0.5;

      const totalScore = distScore * 0.3 + prefMatch * 0.4 + (dest.avg_budget ? 0.3 : 0.15);

      scored.push({
        destination: {
          name: dest.name,
          province: dest.province,
          city: dest.city,
          distance: latitude && longitude && dest.latitude
            ? `${Math.round(this.haversineDistance(latitude, longitude, parseFloat(dest.latitude), parseFloat(dest.longitude)))}km`
            : '未知',
          avg_budget: dest.avg_budget ? `${Math.round(dest.avg_budget)}元/人` : '未知',
          tags,
          summary: `适合${days}天行程`
        },
        trip_preview: {
          days,
          spot_count: 3 + (days > 3 ? days - 3 : 0),
          food_count: 2,
          budget_range: Number.isFinite(maxBudget)
            ? `${Math.round(minBudget)}-${Math.round(maxBudget)}元/人`
            : `${Math.round(minBudget)}元以上/人`
        },
        score: totalScore
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3).map((item, index) => ({ rank: index + 1, ...item }));

    if (top3.length === 0) {
      // 数据库没有合适数据时，用 AI 推荐
      try {
        const { aiGenerator } = await import('../ai/generator.js');
        return await aiGenerator.generateRecommendations({ current_location, days, budget, preferences });
      } catch (err) {
        return { recommendations: [], message: '暂未找到合适的目的地，请调整条件重试' };
      }
    }

    return { recommendations: top3 };
  }
}

export const discoverService = new DiscoverService();
