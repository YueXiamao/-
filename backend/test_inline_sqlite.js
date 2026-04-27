// Direct test of createSqliteDb
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');

console.log('--- Manual createSqliteDb ---');
const sqlite3 = require('sqlite3');
const Database = sqlite3.Database;

// Inline createSqliteDb logic
const config = { db: { path: '/mnt/d/软件开发/旅游小程序/backend/data/travel.db' } };
const dbPath = path.isAbsolute(config.db.path)
  ? config.db.path
  : path.resolve(process.cwd(), config.db.path);

const db = new Database(dbPath, (err) => {
  if (err) { console.error('DB error:', err.message); return; }
  console.log('DB connected to:', dbPath);
});

const wrapper = {
  prepare(sql) {
    return {
      all(...params) {
        return new Promise((resolve, reject) => {
          db.all(sql, ...params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          });
        });
      },
      get(...params) {
        return new Promise((resolve, reject) => {
          db.get(sql, ...params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
          });
        });
      }
    };
  }
};

const result = { db, dbPath, ...wrapper };
console.log('result keys:', Object.keys(result));
console.log('result.prepare:', typeof result.prepare);

db.serialize(() => {
  wrapper.prepare('SELECT id, name FROM destination LIMIT 3').all()
    .then(rows => {
      console.log('Query result:', rows);
      db.close();
    })
    .catch(e => {
      console.error('Query error:', e.message);
      db.close();
    });
});
