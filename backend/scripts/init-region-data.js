// 行政区划数据初始化脚本
// 使用民政部公开数据源
// 执行: node --experimental-network-imports scripts/init-region-data.js
// 或: npm run init:regions

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

const DATA_URL = 'https://raw.githubusercontent.com/modood/Administrative-divisions-json/master/';

async function downloadJson(url) {
  const { default: axios } = await import('axios');
  const res = await axios.get(url);
  return res.data;
}

async function main() {
  console.log('📥 正在下载行政区划数据...');

  try {
    // 下载省/市/区县数据
    const provinces = await downloadJson(DATA_URL + 'China.json');
    console.log(`✅ 获取到 ${provinces.length} 个省份/直辖市/自治区`);

    const allRecords = [];
    let cityCount = 0;
    let districtCount = 0;

    for (const province of provinces) {
      // 省级
      allRecords.push({
        code: province.code,
        name: province.name,
        level: 1,
        parent_code: '',
        lat: province.lat || null,
        lng: province.lng || null
      });

      // 直辖市/特别行政区直接下辖区县
      if (province.children) {
        for (const city of province.children) {
          allRecords.push({
            code: city.code,
            name: city.name,
            level: 2,
            parent_code: province.code,
            lat: city.lat || null,
            lng: city.lng || null
          });
          cityCount++;

          if (city.children) {
            for (const district of city.children) {
              allRecords.push({
                code: district.code,
                name: district.name,
                level: 3,
                parent_code: city.code,
                lat: district.lat || null,
                lng: district.lng || null
              });
              districtCount++;
            }
          }
        }
      }
    }

    console.log(`📊 统计：${cityCount} 个地级市，${districtCount} 个区县`);
    console.log(`📝 共 ${allRecords.length} 条记录`);

    // 保存到文件
    const outputPath = path.join(__dirname, '../data/region-data.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(allRecords, null, 2));
    console.log(`💾 已保存到 ${outputPath}`);

    // 输出插入 SQL
    const sqlPath = path.join(__dirname, 'region-data.sql');
    let sql = 'TRUNCATE TABLE region_data;\n';
    for (const r of allRecords) {
      sql += `INSERT INTO region_data (code, name, level, parent_code, lat, lng) VALUES ('${r.code}', '${r.name.replace(/'/g, "''")}', ${r.level}, '${r.parent_code}', ${r.lat}, ${r.lng});\n`;
    }
    fs.writeFileSync(sqlPath, sql);
    console.log(`💾 SQL已保存到 ${sqlPath}`);
    console.log('📌 执行: mysql -u root -p travel_planner < scripts/region-data.sql');

  } catch (err) {
    console.error('❌ 下载失败:', err.message);
    console.log('⚠️  如果网络受限，请手动下载：');
    console.log('   https://github.com/modood/Administrative-divisions-json');
    process.exit(1);
  }
}

main();
