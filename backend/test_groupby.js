// Debug recommend step by step
import { initDatabase, getDb } from './src/db/database.js';
await initDatabase();
const db = getDb();

console.log('Step 1: Simple select (no GROUP BY)');
const simple = await db.prepare('SELECT id, name, city, latitude, longitude, avg_budget FROM destination LIMIT 3').all();
console.log('  simple rows:', simple);

console.log('\nStep 2: GROUP_CONCAT query');
const grouped = await db.prepare(
  'SELECT d.*, GROUP_CONCAT(dt.tag) as tags FROM destination d LEFT JOIN destination_tag dt ON d.id = dt.destination_id GROUP BY d.id LIMIT 3'
).all();
console.log('  grouped rows:', grouped);

console.log('\nStep 3: GROUP_CONCAT with COUNT');
const cntQuery = await db.prepare(
  'SELECT COUNT(*) as cnt FROM destination d LEFT JOIN destination_tag dt ON d.id = dt.destination_id GROUP BY d.id'
).all();
console.log('  cntQuery:', cntQuery);
