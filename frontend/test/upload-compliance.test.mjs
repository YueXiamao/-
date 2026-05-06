import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const rootPath = dirname(fileURLToPath(import.meta.url)) + '\\..';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8'));
}

test('app config enables required component lazy code loading for upload compliance', () => {
  const appConfig = readJson('./app.json');

  assert.equal(appConfig.lazyCodeLoading, 'requiredComponents');
});

test('frontend package declares es module mode for test and service imports', () => {
  const packageConfig = readJson('./package.json');

  assert.equal(packageConfig.type, 'module');
});

test('frontend package assets stay under upload warning threshold', () => {
  const assets = [
    'assets/backgrounds/city-coast.png',
    'assets/backgrounds/city-default.png',
    'assets/backgrounds/city-mountain.png',
    'assets/backgrounds/city-snow.png',
    'assets/backgrounds/city-urban.png',
    'assets/backgrounds/city-water.png',
    'assets/pref-icons/checkin.png',
    'assets/pref-icons/culture.png',
    'assets/pref-icons/family.png',
    'assets/pref-icons/food.png',
    'assets/pref-icons/hiking.png',
    'assets/pref-icons/shopping.png',
    'assets/pref-icons/vacation.png'
  ];

  const oversized = assets.filter((assetPath) => {
    const size = statSync(join(rootPath, assetPath)).size;
    return size > 200 * 1024;
  });

  assert.deepEqual(oversized, []);
});

test('app config does not keep component placeholders for unused components', () => {
  const appConfig = readJson('./app.json');

  assert.equal(appConfig.componentPlaceholder, undefined);
});

test('frontend package does not keep legacy unused component directory', () => {
  assert.equal(existsSync(join(rootPath, 'components')), false);
});

test('frontend package does not keep legacy amap wrapper after backend proxy migration', () => {
  assert.equal(existsSync(join(rootPath, 'utils/amap.js')), false);
});
