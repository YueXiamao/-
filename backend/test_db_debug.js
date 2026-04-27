// Debug: what does getDb() actually return?
import { initDatabase, getDb } from './src/db/database.js';

console.log('Before init - getDb() throws?');
try {
  const db1 = getDb();
  console.log('  db1 keys:', Object.keys(db1));
} catch(e) {
  console.log('  throws:', e.message);
}

await initDatabase();

const db = getDb();
console.log('\nAfter init:');
console.log('  db === null:', db === null);
console.log('  typeof db:', typeof db);
console.log('  db keys:', Object.keys(db));
console.log('  db.prepare:', typeof db.prepare);
console.log('  db.exec:', typeof db.exec);
