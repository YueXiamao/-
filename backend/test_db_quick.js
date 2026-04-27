// 快速测试 db prepare().all()
import { initDatabase, getDb } from './src/db/database.js';
await initDatabase();
const db = getDb();

console.log('Testing db.prepare().all()...');
const start = Date.now();
try {
  const rows = await db.prepare('SELECT COUNT(*) as cnt FROM destination').all();
  console.log(`✅ SELECT COUNT took ${Date.now()-start}ms, rows:`, rows);
} catch(e) {
  console.error(`❌ ERROR after ${Date.now()-start}ms:`, e.message);
}
