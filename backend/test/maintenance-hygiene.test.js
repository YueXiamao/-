import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const backendRoot = dirname(fileURLToPath(import.meta.url)) + '\\..';

const legacyDebugScripts = [
  'test_db.js',
  'test_db_debug.js',
  'test_db_quick.js',
  'test_groupby.js',
  'test_inline_sqlite.js',
  'test_native_sqlite.js',
  'test_recommend.js',
  'test_recommend2.js',
  'test_sqlite3_api.js'
];

test('backend root does not keep ad-hoc debug scripts alongside production code', () => {
  const remaining = legacyDebugScripts.filter((fileName) => (
    existsSync(join(backendRoot, fileName))
  ));

  assert.deepEqual(remaining, []);
});

test('backend npm lifecycle scripts are pinned to the project Node 20 launcher', () => {
  const packageJson = JSON.parse(readFileSync(join(backendRoot, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts.start, 'node scripts/run-with-node20.cjs src/index.js');
  assert.equal(packageJson.scripts.dev, 'node scripts/run-with-node20.cjs --watch src/index.js');
  assert.equal(packageJson.scripts.test, 'node scripts/run-with-node20.cjs --test');
});
