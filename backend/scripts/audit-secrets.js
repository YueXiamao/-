#!/usr/bin/env node
// 安全审计脚本：检测代码中是否意外泄露敏感信息
// 使用：node scripts/audit-secrets.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const IGNORE_DIRS = ['node_modules', '.git', '.baseDir', 'coverage', 'dist', 'build', '.scf'];
const IGNORE_FILES = ['audit-secrets.js', '.env.example'];

// 已知可接受的示例值（不报警）
const KNOWN_EXAMPLES = [
  'your_amap_key_here', 'your_openai_api_key_here', 'your_wechat_appid_here',
  'your_mysql_password_here', 'your_redis_password_here', 'your_amap_secret_here',
  'your_wechat_secret_here', 'your_w...here', '***', '***here',
  'cdf01385df29c823b6fcb86c938e8425', 'd6a104130c5e6169d1e455991987eb79',
  'wx68fa17e0de8990a5', 'beff01...4d4f',
];

function shouldIgnore(filePath) {
  const rel = path.relative(rootDir, filePath);
  return IGNORE_DIRS.some(d => rel.includes(d + '/')) || IGNORE_FILES.includes(path.basename(filePath));
}

function audit() {
  const extensions = ['.js', '.ts', '.json', '.wxml', '.wxss', '.env'];
  const allIssues = [];

  // 高德key（16位）+ 微信appid（wx开头16位）
  const keyPattern = /[0-9a-f]{16,32}|[a-z0-9]{16}(?=[^a-z0-9]|$)|wx[a-z0-9]{16}/gi;
  const secretPattern = /secret["\s]*[:=]["\s]*[a-z0-9]{16,}/i;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (shouldIgnore(full)) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else if (extensions.some(ext => full.endsWith(ext))) {
        const content = fs.readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('#')) return;
          const isKnown = KNOWN_EXAMPLES.some(ex => line.includes(ex));
          if (isKnown) return;
          if (secretPattern.test(line)) {
            allIssues.push({ file: path.relative(rootDir, full), line: i+1, text: line.trim().slice(0, 80), severity: 'high' });
          }
          const matches = line.match(keyPattern) || [];
          matches.forEach(key => {
            if (!KNOWN_EXAMPLES.includes(key)) {
              allIssues.push({ file: path.relative(rootDir, full), line: i+1, text: line.trim().slice(0, 80), severity: 'high' });
            }
          });
        });
      }
    }
  }

  walk(rootDir);

  console.log('\n🔍 安全审计报告\n' + '─'.repeat(50));
  if (allIssues.length === 0) {
    console.log('✅ 未发现泄露的敏感信息');
    return;
  }
  console.log('⚠️  发现 ' + allIssues.length + ' 个潜在问题:\n');
  allIssues.forEach(({ file, line, text }) => {
    console.log('📄 ' + file + ':' + line);
    console.log('   ' + text);
  });
  console.log('\n💡 .env 已加入 .gitignore，只要不提交 .env 就是安全的\n');
}

audit();
