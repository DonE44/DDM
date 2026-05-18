import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const reportDir = path.resolve(repoRoot, process.argv[2] || 'release');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const reportPath = path.join(reportDir, `core-validation-${stamp}.txt`);

const checks = [];

function add(name, ok, details = '') {
  checks.push({ name, ok, details });
}

function run(command, args, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        Path: `C:\\Program Files\\nodejs;${process.env.Path || process.env.PATH || ''}`,
      },
      shell: false,
    });

    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      output += `\n[TIMEOUT after ${timeoutMs}ms]`;
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: error.message });
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: signal ? 1 : code ?? 0, output });
    });
  });
}

fs.mkdirSync(reportDir, { recursive: true });

for (const file of [
  'package.json',
  'electron/main.cjs',
  'electron/preload.cjs',
  'src/App.jsx',
  'scripts/start-desktop-dev.cjs',
  'scripts/build-desktop.mjs',
]) {
  add(`Exists: ${file}`, fs.existsSync(path.join(repoRoot, file)));
}

const nodeExe = process.execPath;

for (const script of [
  'scripts/start-desktop-dev.cjs',
  'scripts/start-desktop-dev.mjs',
  'scripts/build-desktop.mjs',
  'scripts/run-electron-builder.mjs',
  'scripts/todo-audit.mjs',
  'scripts/command-audit.mjs',
]) {
  const result = await run(nodeExe, ['-c', script], 30000);
  add(`Syntax: ${script}`, result.code === 0, result.output);
}

for (const [name, args, timeout] of [
  ['ESLint', ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings', '0'], 180000],
  ['Vite build', ['node_modules/vite/bin/vite.js', 'build'], 180000],
  ['Command audit', ['scripts/command-audit.mjs', '--app-file', 'src/App.jsx', '--results-file', 'docs/command-test-results.md', '--report-dir', 'release'], 180000],
]) {
  const result = await run(nodeExe, args, timeout);
  add(name, result.code === 0, result.output.split(/\r?\n/).slice(-20).join('\n'));
}

add(
  'Unpacked executable available',
  fs.existsSync(path.join(reportDir, 'win-unpacked', 'FluxAura Studio.exe')),
  path.join(reportDir, 'win-unpacked', 'FluxAura Studio.exe'),
);

const pass = checks.filter((check) => check.ok).length;
const fail = checks.length - pass;
const lines = [
  '',
  '  FluxAura Studio Core Validation Report',
  `  Generated: ${new Date().toLocaleString()}`,
  `  Machine  : ${process.env.COMPUTERNAME || ''}`,
  `  User     : ${process.env.USERNAME || ''}`,
  '='.repeat(72),
  '',
  ...checks.flatMap((check) => [
    `  [${check.ok ? 'PASS' : 'FAIL'}] ${check.name}`,
    ...(check.ok || !check.details ? [] : check.details.split(/\r?\n/).filter(Boolean).map((line) => `    ${line}`)),
  ]),
  '',
  '='.repeat(72),
  `  SUMMARY: ${fail === 0 ? 'CORE READY' : 'CORE ISSUES'}`,
  `  Passed : ${pass} / ${checks.length}`,
  `  Failed : ${fail} / ${checks.length}`,
  '='.repeat(72),
  '',
];

fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`Report: ${reportPath}`);
console.log(`PASSED=${pass} FAILED=${fail} STATUS=${fail === 0 ? 'CORE READY' : 'CORE ISSUES'}`);
process.exit(fail === 0 ? 0 : 1);
