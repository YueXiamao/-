// 直接测试 recommend（不触发 AI fallback）
import { initDatabase, getDb } from './src/db/database.js';
await initDatabase();
const db = getDb();

// 直接测数据库查询
console.log('=== 直接测 db.prepare().all() ===');
try {
  const rows = await db.prepare('SELECT name, city FROM destination LIMIT 3').all();
  console.log('rows:', rows);
} catch(e) {
  console.error('ERROR:', e.message);
}

// 测试 recommend
console.log('\n=== 测试 discoverService.recommend ===');
const { discoverService } = await import('./src/services/discoverService.js');
try {
  const result = await discoverService.recommend({
    current_location: { city: '成都', latitude: 30.57, longitude: 104.06 },
    days: 3,
    budget: '1000-2000',
    preferences: []
  });
  console.log('✅ recommendations count:', result.recommendations?.length);
  result.recommendations?.forEach(r => {
    console.log(`  TOP${r.rank}: ${r.destination.name} | 距离:${r.destination.distance} | 评分:${r.score.toFixed(2)}`);
  });
} catch(e) {
  console.error('❌ ERROR:', e.message);
  console.error(e.stack?.split('\n').slice(0,5).join('\n'));
}
