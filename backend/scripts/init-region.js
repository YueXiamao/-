// 行政区划数据初始化脚本
// 运行: node scripts/init-region.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/travel.db');
const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dbPath)) {
  console.error('数据库不存在，请先运行一次: node src/index.js');
  process.exit(1);
}

const db = new Database(dbPath);

async function downloadJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('📥 正在下载行政区划数据...');
  
  // 使用 GitHub CDN
  const provinces = await downloadJson('https://cdn.jsdelivr.net/gh/modood/Administrative-divisions-json@master/dist/provinces.json');
  const cities = await downloadJson('https://cdn.jsdelivr.net/gh/modood/Administrative-divisions-json@master/dist/cities.json');
  const districts = await downloadJson('https://cdn.jsdelivr.net/gh/modood/Administrative-divisions-json@master/dist/districts.json');

  console.log(`✅ 下载完成: ${provinces.length}省 ${cities.length}市 ${districts.length}区县`);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO region_data (code, name, level, parent_code)
    VALUES (?, ?, ?, ?)
  `);

  let count = 0;
  const tx = db.transaction(() => {
    for (const p of provinces) {
      insert.run(p.code, p.name, 1, '');
      count++;
    }
    for (const c of cities) {
      insert.run(c.code, c.name, 2, c.provinceCode);
      count++;
    }
    for (const d of districts) {
      insert.run(d.code, d.name, 3, d.cityCode);
      count++;
    }
  });

  tx();
  console.log(`✅ 写入 ${count} 条行政区划数据`);
  
  // 验证
  const { total } = db.prepare('SELECT COUNT(*) as total FROM region_data').get();
  console.log(`📊 数据库当前: ${total} 条记录`);
  
  db.close();
}

main().catch(err => {
  console.error('导入失败:', err.message);
  process.exit(1);
});
