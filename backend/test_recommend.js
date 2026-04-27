// 测试 discover/recommend 接口
import { initDatabase } from './src/db/database.js';
import { discoverService } from './src/services/discoverService.js';

await initDatabase();

console.log('测试 recommend...');
try {
  const result = await discoverService.recommend({
    current_location: { city: '成都', latitude: 30.57, longitude: 104.06 },
    days: 3,
    budget: '1000-2000',
    preferences: []
  });
  console.log('✅ result:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error('❌ ERROR:', e.message);
  console.error(e.stack);
}
