// 直接用 sqlite3 原生查（不用 wrapper）
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3');

const dbPath = '/mnt/d/软件开发/旅游小程序/backend/data/travel.db';
const db = new sqlite3.Database(dbPath);

console.log('直接查 destination 表（前5行）:');
db.each('SELECT id, name, city FROM destination LIMIT 5', (err, row) => {
  if (err) console.error('ERROR:', err.message);
  else console.log('  row:', row);
});

db.all('SELECT id, name, city FROM destination LIMIT 5', (err, rows) => {
  if (err) console.error('db.all ERROR:', err.message);
  else console.log('\ndb.all rows:', rows);
  db.close();
});
