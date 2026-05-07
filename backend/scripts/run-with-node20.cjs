const { existsSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const backendRoot = resolve(__dirname, '..');
const repoRoot = resolve(backendRoot, '..');
const args = process.argv.slice(2);

function nodeMajor(executable) {
  const result = spawnSync(executable, ['-p', 'process.versions.node.split(".")[0]'], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    return null;
  }

  return Number.parseInt(result.stdout.trim(), 10);
}

function findNode20() {
  const candidates = [
    process.env.NODE20_EXE,
    resolve(repoRoot, '.tools', 'node20', 'node.exe'),
    resolve(repoRoot, '.tools', 'node20', 'node')
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate) && nodeMajor(candidate) === 20);
}

if (args.length === 0) {
  console.error('[node20] Missing script arguments.');
  process.exit(1);
}

const currentMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
const executable = currentMajor === 20 ? process.execPath : findNode20();

if (!executable) {
  console.error('[node20] Node 20 is required for better-sqlite3 native bindings.');
  console.error('[node20] Expected local runtime: ..\\.tools\\node20\\node.exe');
  console.error('[node20] Or set NODE20_EXE to a Node 20 executable.');
  process.exit(1);
}

const env = {
  ...process.env,
  PATH: `${dirname(executable)};${process.env.PATH || ''}`
};

const child = spawnSync(executable, args, {
  cwd: backendRoot,
  env,
  stdio: 'inherit'
});

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(child.status ?? 1);
