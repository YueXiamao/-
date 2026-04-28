#!/usr/bin/env node
// 行政区划数据导入脚本
// 数据源：高德地图 Web API（https://restapi.amap.com）
// 使用：node scripts/import-regions.js

import axios from 'axios';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const dbPath = path.join(rootDir, 'data/travel.db');
const dataDir = path.join(rootDir, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const AMAP_KEY = process.env.AMAP_KEY;
if (!AMAP_KEY) {
  console.error('错误: 请设置环境变量 AMAP_KEY');
  console.error('  export AMAP_KEY=你的高德key');
  process.exit(1);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 递归解析高德行政区划树
function parseDistricts(districts, parentCode = '', level = 1) {
  const records = [];

  for (const d of districts) {
    const code = d.adcode?.toString() || '';
    if (!code || code === '0') continue;

    // 跳过"中华人民共和国"根节点本身
    if (code === '100000') {
      // 递归解析其下级
      if (d.districts && d.districts.length > 0) {
        records.push(...parseDistricts(d.districts, '', 1));
      }
      continue;
    }

    let lat = null, lng = null;
    if (d.center) {
      const parts = d.center.split(',');
      if (parts.length === 2) {
        lng = parseFloat(parts[0]) || null;
        lat = parseFloat(parts[1]) || null;
      }
    }

    records.push({ code, name: d.name, level, parent_code: parentCode, lat, lng });

    if (d.districts && d.districts.length > 0) {
      records.push(...parseDistricts(d.districts, code, level + 1));
    }
  }

  return records;
}

async function main() {
  console.log('=== 行政区划数据导入 ===');
  console.log('数据库:', dbPath);
  console.log('');

  // 检查现有数据
  const { count } = db.prepare('SELECT COUNT(*) as count FROM region_data').get();
  console.log(`现有数据: ${count} 条`);

  if (count > 0) {
    const overwrite = process.argv.includes('--force');
    if (!overwrite) {
      console.log('已有数据，跳过。传入 --force 强制重新导入（会清空旧数据）。');
      process.exit(0);
    }
    console.log('强制模式，清空旧数据...');
    db.exec('DELETE FROM region_data');
  }

  // 从高德获取全国数据（subdistrict=3 三级）
  console.log('\n📡 从高德 API 获取全国行政区划...');
  let districts;
  try {
    const resp = await axios.get('https://restapi.amap.com/v3/config/district', {
      params: {
        key: AMAP_KEY,
        keywords: '中国',
        subdistrict: 3,
        page: 1,
        offset: 1000,
        showbiz: false,
        extensions: 'base'
      },
      timeout: 15000
    });

    if (resp.data.status !== '1' || !resp.data.districts?.[0]?.districts) {
      throw new Error(resp.data.info || 'API 返回异常');
    }

    // 取"中华人民共和国"节点下的省级列表
    districts = resp.data.districts[0].districts;
    console.log(`获取到 ${districts.length} 个省级行政区`);
  } catch (err) {
    console.error('获取数据失败:', err.message);
    process.exit(1);
  }

  // 解析并入库
  const allRecords = parseDistricts(districts);
  console.log(`\n解析出 ${allRecords.length} 条记录`);
  console.log(`  省级: ${allRecords.filter(r => r.level === 1).length}`);
  console.log(`  地级: ${allRecords.filter(r => r.level === 2).length}`);
  console.log(`  区县: ${allRecords.filter(r => r.level === 3).length}`);

  // 批量插入
  const insert = db.prepare(`
    INSERT OR IGNORE INTO region_data (code, name, level, parent_code, lat, lng)
    VALUES (@code, @name, @level, @parent_code, @lat, @lng)
  `);

  const insertAll = db.transaction((records) => {
    let n = 0;
    for (const r of records) {
      insert.run(r);
      n++;
    }
    return n;
  });

  const inserted = insertAll(allRecords);
  console.log(`\n✅ 实际写入 ${inserted} 条（去重跳过）`);

  // 统计验证
  const stats = {
    total: db.prepare('SELECT COUNT(*) as n FROM region_data').get().n,
    p1: db.prepare("SELECT COUNT(*) as n FROM region_data WHERE level = 1").get().n,
    p2: db.prepare("SELECT COUNT(*) as n FROM region_data WHERE level = 2").get().n,
    p3: db.prepare("SELECT COUNT(*) as n FROM region_data WHERE level = 3").get().n,
  };

  console.log('\n📊 数据库验证:');
  console.log(`   总记录: ${stats.total}`);
  console.log(`   省级: ${stats.p1}`);
  console.log(`   地级: ${stats.p2}`);
  console.log(`   区县: ${stats.p3}`);

  // 抽查几条
  console.log('\n🔍 抽查（省级）:');
  const samples = db.prepare("SELECT name, code FROM region_data WHERE level = 1 LIMIT 5").all();
  samples.forEach(r => console.log(`   ${r.name} (${r.code})`));

  db.close();
}

main().catch(err => {
  console.error('导入失败:', err.message);
  db.close();
  process.exit(1);
});
