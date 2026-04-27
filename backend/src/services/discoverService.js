/**
 * 随机玩推荐服务
 * 根据用户当前位置、偏好、天数，生成 Top 3 推荐目的地
 */
import { getDb } from '../db/database.js';
import { poiService } from './poiService.js';

async function query(sql, ...params) {
  const db = getDb();
  return db.all(sql, ...params);
}

const BUDGET_MAP = {
  '0-500': { min: 0, max: 500 },
  '500-1000': { min: 500, max: 1000 },
  '1000-2000': { min: 1000, max: 2000 },
  '2000-5000': { min: 2000, max: 5000 },
  '5000+': { min: 5000, max: 99999 },
};

const SCORE_WEIGHTS = {
  preference_match: 3,
  budget_fit: 2,
  diversity: 1,
  distance: 1,
};

function calcPreferenceScore(userPrefs = [], destTags = []) {
  if (!userPrefs.length || !destTags.length) return 1;
  const lowerPrefs = userPrefs.map((p) => p.toLowerCase());
  const lowerTags = destTags.map((t) => t.toLowerCase());
  let match = 0;
  for (const pref of lowerPrefs) {
    for (const tag of lowerTags) {
      if (tag.includes(pref) || pref.includes(tag)) {
        match += 1;
        break;
      }
    }
  }
  return Math.min(match, 3);
}

function calcBudgetScore(budgetRange, avgBudget) {
  if (!budgetRange || !avgBudget) return 1;
  const parts = budgetRange.replace('+', '-99999').split('-');
  const min = Number(parts[0]);
  const max = Number(parts[1] || parts[0]);
  const budget = typeof avgBudget === 'string' ? parseFloat(avgBudget) : avgBudget;
  if (budget >= min && budget <= max) return 2;
  if (budget < min) return Math.max(0, 1 - (min - budget) / 1000);
  return Math.max(0, 1 - (budget - max) / 2000);
}

function calcDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcScore(dest, userPrefs, budgetRange, userLat, userLon) {
  const prefScore = calcPreferenceScore(userPrefs, dest.tags || []);
  const budgetScore = calcBudgetScore(budgetRange, dest.avg_budget);
  const dist = dest.latitude && dest.longitude && userLat && userLon
    ? calcDistance(userLat, userLon, dest.latitude, dest.longitude)
    : null;
  const distScore = dist !== null ? Math.max(0, 2 - dist / 500) : 1;
  return prefScore * SCORE_WEIGHTS.preference_match +
    budgetScore * SCORE_WEIGHTS.budget_fit +
    distScore * SCORE_WEIGHTS.distance +
    SCORE_WEIGHTS.diversity;
}

const FALLBACK_DESTS = [
  { name: '成都', city: '成都', province: '四川', latitude: 30.6598, longitude: 104.0658, avg_budget: 600, description: '天府之国、休闲之都', tags: ['美食', '文化', '休闲'] },
  { name: '杭州', city: '杭州', province: '浙江', latitude: 30.2741, longitude: 120.1551, avg_budget: 800, description: '人间天堂、西湖美景', tags: ['风景', '休闲', '文化'] },
  { name: '厦门', city: '厦门', province: '福建', latitude: 24.4798, longitude: 118.0894, avg_budget: 700, description: '海上花园、文艺清新', tags: ['海滨', '美食', '小清新'] },
  { name: '丽江', city: '丽江', province: '云南', latitude: 26.8723, longitude: 100.2287, avg_budget: 500, description: '艳遇之都、古城风情', tags: ['古城', '民族', '风景'] },
  { name: '西安', city: '西安', province: '陕西', latitude: 34.3416, longitude: 108.9398, avg_budget: 600, description: '千年古都、历史遗迹', tags: ['历史', '文化', '美食'] },
  { name: '青岛', city: '青岛', province: '山东', latitude: 36.0671, longitude: 120.3826, avg_budget: 700, description: '啤酒之城、海洋气候', tags: ['海滨', '美食', '啤酒'] },
];

function getFallbackRecommendations({ current_location, days = 2, budget = '1000-2000', preferences = [] }) {
  const scored = FALLBACK_DESTS.map((dest) => ({
    ...dest,
    _score: calcScore(dest, preferences, budget, current_location?.latitude, current_location?.longitude),
  }));
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, 3).map((dest, index) => ({
    rank: index + 1,
    destination: {
      id: null,
      name: dest.name,
      city: dest.city,
      province: dest.province,
      latitude: dest.latitude,
      longitude: dest.longitude,
      distance: current_location?.latitude
        ? `${calcDistance(current_location.latitude, current_location.longitude, dest.latitude, dest.longitude)?.toFixed(0) || '?'}km`
        : null,
      avg_budget: dest.avg_budget,
      tags: dest.tags,
      summary: dest.description,
      description: dest.description,
    },
    score: Math.round(dest._score * 100) / 100,
    trip_preview: { days, spot_count: 3, food_count: 2, budget_range: `¥${dest.avg_budget}` },
  }));
}

/**
 * 获取随机玩推荐
 * @param {object} params
 * @param {object} params.current_location - { latitude, longitude, city }
 * @param {number} params.days - 天数
 * @param {string} params.budget - 预算范围
 * @param {string[]} params.preferences - 偏好列表
 * @returns {Promise<object[]>} Top 3 推荐
 */
export async function getRecommendations({ current_location, days = 2, budget = '1000-2000', preferences = [] } = {}) {
  // 数据库无数据时用 fallback
  let allDests = [];
  try {
    const rows = await query('SELECT * FROM destinations LIMIT 50');
    if (rows && rows.length > 0) allDests = rows;
  } catch (_) {
    // 表可能不存在
  }

  let recommendations;
  if (!allDests.length) {
    recommendations = getFallbackRecommendations({ current_location, days, budget, preferences });
  } else {
    // 打乱顺序后取前6
    const shuffled = allDests.sort(() => Math.random() - 0.5).slice(0, 6);
    const scored = shuffled.map((dest) => ({
      ...dest,
      _score: calcScore(dest, preferences, budget, current_location?.latitude, current_location?.longitude),
    }));
    scored.sort((a, b) => b._score - a._score);

    recommendations = await Promise.all(
      scored.slice(0, 3).map(async (dest, index) => {
        let spotCount = 3, foodCount = 2;
        try {
          const pois = await poiService.search({ keyword: dest.name, city: dest.name, limit: 5 });
          if (pois?.length) {
            spotCount = pois.filter((p) => p.type?.includes('景点') || p.type?.includes('风景')).length || 1;
            foodCount = pois.filter((p) => p.type?.includes('美食')).length || 1;
          }
        } catch (_) {}

        return {
          rank: index + 1,
          destination: {
            id: dest.id || null,
            name: dest.name,
            city: dest.city || dest.name,
            province: dest.province || '',
            latitude: dest.latitude || null,
            longitude: dest.longitude || null,
            distance: current_location?.latitude && dest.latitude
              ? `${calcDistance(current_location.latitude, current_location.longitude, dest.latitude, dest.longitude)?.toFixed(0) || '?'}km`
              : null,
            avg_budget: dest.avg_budget || budget.split('-')[0],
            tags: dest.tags ? dest.tags.split(',').filter(Boolean) : [],
            summary: dest.description || dest.summary || `${dest.name}是一个值得一去的目的地`,
            description: dest.description || '',
          },
          score: Math.round(dest._score * 100) / 100,
          trip_preview: { days, spot_count: spotCount, food_count: foodCount, budget_range: `¥${dest.avg_budget || budget.split('-')[0]}` },
        };
      })
    );
  }

  return recommendations;
}
