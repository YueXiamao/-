// 测试 database.js 的 prepare().all() 是否工作
import { initDatabase, getDb } from './src/db/database.js';

await initDatabase();
const db = getDb();

console.log('db type:', typeof db);
console.log('db.prepare:', typeof db.prepare);

try {
  const rows = await db.prepare(
    `SELECT d.*, GROUP_CONCAT(dt.tag) as tags
     FROM destination d
     LEFT JOIN destination_tag dt ON d.id = dt.destination_id
     GROUP BY d.id
     LIMIT 3`
  ).all();
  console.log('✅ prepare().all() works! rows:', rows.length);
  if (rows.length > 0) {
    console.log('Sample:', rows[0].name, '| tags:', rows[0].tags);
  }
} catch(e) {
  console.error('❌ prepare().all() ERROR:', e.message);
}
