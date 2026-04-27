// Test db.all with array vs spread
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3');

const db = new sqlite3.Database(':memory:');
db.run('CREATE TABLE t (id, name)');
db.run('INSERT INTO t VALUES (1, "a")');
db.run('INSERT INTO t VALUES (2, "b")');

console.log('Test 1: db.all(sql, [params], cb) - params is array');
db.all('SELECT * FROM t WHERE id > ?', [1], (err, rows) => {
  console.log('  Result:', rows, '| err:', err?.message);
});

db.all('SELECT * FROM t WHERE id > ?', 1, (err, rows) => {
  console.log('Test 2: db.all(sql, param, cb) - param is scalar');
  console.log('  Result:', rows, '| err:', err?.message);
  db.close(() => process.exit(0));
});
