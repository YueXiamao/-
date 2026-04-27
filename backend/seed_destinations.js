// 插入种子目的地数据（SQLite）
import { initDatabase, getDb } from './src/db/database.js';

await initDatabase();
const db = getDb();

console.log('正在插入种子目的地数据...');

// 目的地数据
const destinations = [
  { name: '成都', province: '四川', city: '成都', level: 'hot', lat: 30.5728, lng: 104.0668, budget: 1500, tags: '美食,休闲,文化' },
  { name: '都江堰', province: '四川', city: '成都', level: 'normal', lat: 30.9988, lng: 103.6108, budget: 800, tags: '历史,自然,文化' },
  { name: '峨眉山', province: '四川', city: '乐山', level: 'hot', lat: 29.5281, lng: 103.4876, budget: 1200, tags: '自然,徒步,文化' },
  { name: '乐山大佛', province: '四川', city: '乐山', level: 'normal', lat: 29.5441, lng: 103.7688, budget: 600, tags: '历史,文化' },
  { name: '九寨沟', province: '四川', city: '阿坝', level: 'hot', lat: 33.1027, lng: 103.9135, budget: 2500, tags: '自然,摄影,徒步' },
  { name: '稻城亚丁', province: '四川', city: '甘孜', level: 'normal', lat: 28.2890, lng: 100.6055, budget: 3000, tags: '自然,徒步,摄影' },
  { name: '重庆', province: '重庆', city: '重庆', level: 'hot', lat: 29.5630, lng: 106.5516, budget: 1800, tags: '美食,夜景,文化' },
  { name: '西安', province: '陕西', city: '西安', level: 'hot', lat: 34.3416, lng: 108.9398, budget: 2000, tags: '历史,文化,美食' },
  { name: '杭州', province: '浙江', city: '杭州', level: 'hot', lat: 30.2741, lng: 120.1551, budget: 2200, tags: '休闲,自然,美食' },
  { name: '苏州', province: '江苏', city: '苏州', level: 'normal', lat: 31.2989, lng: 120.5853, budget: 1600, tags: '文化,园林,休闲' },
  { name: '厦门', province: '福建', city: '厦门', level: 'hot', lat: 24.4798, lng: 118.0894, budget: 2000, tags: '海边,美食,休闲' },
  { name: '三亚', province: '海南', city: '三亚', level: 'hot', lat: 18.2528, lng: 109.5119, budget: 3500, tags: '海边,度假,休闲' },
  { name: '大理', province: '云南', city: '大理', level: 'hot', lat: 25.6069, lng: 100.2676, budget: 1800, tags: '自然,文化,休闲' },
  { name: '丽江', province: '云南', city: '丽江', level: 'hot', lat: 26.8723, lng: 100.2300, budget: 2000, tags: '古城,文化,自然' },
  { name: '上海', province: '上海', city: '上海', level: 'hot', lat: 31.2304, lng: 121.4737, budget: 2500, tags: '都市,美食,购物' },
  { name: '北京', province: '北京', city: '北京', level: 'hot', lat: 39.9042, lng: 116.4074, budget: 2200, tags: '历史,文化,都市' },
  { name: '广州', province: '广东', city: '广州', level: 'hot', lat: 23.1291, lng: 113.2644, budget: 1800, tags: '美食,都市,文化' },
  { name: '深圳', province: '广东', city: '深圳', level: 'hot', lat: 22.5431, lng: 114.0579, budget: 2000, tags: '都市,购物,海边' },
  { name: '青岛', province: '山东', city: '青岛', level: 'normal', lat: 36.0671, lng: 120.3826, budget: 1800, tags: '海边,美食,休闲' },
  { name: '南京', province: '江苏', city: '南京', level: 'normal', lat: 32.0603, lng: 118.7969, budget: 1600, tags: '历史,文化,美食' },
  { name: '武汉', province: '湖北', city: '武汉', level: 'normal', lat: 30.5928, lng: 114.3055, budget: 1200, tags: '美食,文化,湖泊' },
  { name: '长沙', province: '湖南', city: '长沙', level: 'normal', lat: 28.2282, lng: 112.9388, budget: 1200, tags: '美食,文化,夜生活' },
  { name: '桂林', province: '广西', city: '桂林', level: 'hot', lat: 25.2736, lng: 110.2900, budget: 1500, tags: '自然,摄影,山水' },
  { name: '张家界', province: '湖南', city: '张家界', level: 'hot', lat: 29.1171, lng: 110.4795, budget: 1800, tags: '自然,徒步,摄影' },
];

let inserted = 0;
for (const dest of destinations) {
  try {
    const result = await db.prepare(`
      INSERT INTO destination (name, province, city, level, latitude, longitude, avg_budget, hot_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(dest.name, dest.province, dest.city, dest.level, dest.lat, dest.lng, dest.budget, dest.level === 'hot' ? 100 : 10);
    const destId = result.lastInsertRowid;

    // 插入标签
    for (const tag of dest.tags.split(',')) {
      await db.prepare(
        'INSERT OR IGNORE INTO destination_tag (destination_id, tag) VALUES (?, ?)'
      ).run(destId, tag.trim());
    }
    inserted++;
    console.log(`  ✅ ${dest.name}`);
  } catch(e) {
    console.log(`  ⚠️  ${dest.name}: ${e.message}`);
  }
}

console.log(`\n总计插入 ${inserted}/${destinations.length} 个目的地`);

// 验证
const cnt = await db.prepare('SELECT COUNT(*) as cnt FROM destination').all();
const tagCnt = await db.prepare('SELECT COUNT(*) as cnt FROM destination_tag').all();
console.log(`destination 表: ${JSON.stringify(cnt[0])}`);
console.log(`destination_tag 表: ${JSON.stringify(tagCnt[0])}`);
