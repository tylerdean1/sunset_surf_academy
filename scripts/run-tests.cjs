const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tests = fs.readdirSync(path.join(process.cwd(), 'tests'))
    .filter((name) => /\.test\.(?:ts|cjs|mjs|js)$/.test(name))
    .sort()
    .map((name) => path.join('tests', name));
if (!tests.length) throw new Error('No tests found');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
