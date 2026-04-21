// 随机玩推荐服务
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import { aiGenerator } from '../ai/generator.js';

class DiscoverService {
  getPool() {
    return mysql.createPool(config.db);
  }

  // 计算两点间 Haversine 距离
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 根据天数判断最大出行距离
  maxDistanceByDays(days) {
    if (days === 1) return 100;
    if (days === 2) return 300;
    if (days <= 4) return 800;
    return 2000;
  }

  // 根据预算筛选目的地
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

    const pool = this.getPool();

    // 查询候选目的地
    const [destinations] = await pool.query(
      `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
       FROM destination d
       LEFT JOIN destination_tag dt ON d.id = dt.destination_id
       GROUP BY d.id`
    );

    await pool.end();

    const [minBudget, maxBudget] = this.budgetToRange(budget);
    const maxDist = this.maxDistanceByDays(days);

    const scored = [];

    for (const dest of destinations) {
      const dist = latitude && longitude && dest.latitude && dest.longitude
        ? this.haversineDistance(latitude, longitude, parseFloat(dest.latitude), parseFloat(dest.longitude))
        : 999999;

      if (dist > maxDist) continue;
      if (dest.avg_budget && (dest.avg_budget < minBudget || dest.avg_budget > maxBudget)) continue;

      const distanceScore = 1 - (dist / maxDist);
      const budgetScore = dest.avg_budget
        ? 1 - Math.abs(dest.avg_budget - (minBudget + maxBudget) / 2) / (maxBudget - minBudget || 1)
        : 0.5;

      const tags = dest.tags ? dest.tags.split(',') : [];
      const prefMatch = preferences && preferences.length > 0
        ? tags.filter(t => preferences.includes(t)).length / preferences.length
        : 0.5;

      const totalScore = distanceScore * 0.3 + budgetScore * 0.3 + prefMatch * 0.4;

      scored.push({
        destination: {
          name: dest.name,
          province: dest.province,
          city: dest.city,
          distance: `${Math.round(dist)}km`,
          avg_budget: dest.avg_budget ? `${Math.round(dest.avg_budget)}元/人` : '未知',
          tags,
          summary: `距离${city || '当前位置'}${Math.round(dist)}km，适合${days}天行程`
        },
        trip_preview: {
          days,
          spot_count: Math.floor(Math.random() * 3) + 3,
          food_count: Math.floor(Math.random() * 2) + 2,
          budget_range: `${Math.round(minBudget)}-${Math.round(maxBudget)}元/人`
        },
        score: totalScore
      });
    }

    // 排序并取 Top 3
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    if (top3.length === 0) {
      // 没有合适目的地时，用 AI 生成推荐
      try {
        return await aiGenerator.generateRecommendations({ current_location, days, budget, preferences });
      } catch (err) {
        return { recommendations: [], message: '暂未找到合适的目的地，请调整条件重试' };
      }
    }

    return { recommendations: top3 };
  }

  // 为某个目的地生成行程
  async generateTripForDestination({ destination_name, days, preferences, start_date }) {
    return {
      trip_id: `D${Date.now()}`,
      title: `${destination_name}${days}日游`,
      destinations: [{ name: destination_name }],
      days,
      start_date,
      itinerary: [] // 前端拿到后调用 /api/trip/generate 重新生成
    };
  }
}

export const discoverService = new DiscoverService();
