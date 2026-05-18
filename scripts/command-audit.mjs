import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const appFile = argValue('--app-file', 'src/App.jsx');
const resultsFile = argValue('--results-file', 'docs/command-test-results.md');
const reportDir = argValue('--report-dir', 'release');
const appPath = path.resolve(repoRoot, appFile);
const resultsPath = path.resolve(repoRoot, resultsFile);
const reportRoot = path.resolve(repoRoot, reportDir);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(appPath)) fail(`App file not found: ${appFile}`);
if (!fs.existsSync(resultsPath)) fail(`Results file not found: ${resultsFile}`);
fs.mkdirSync(reportRoot, { recursive: true });

const appText = fs.readFileSync(appPath, 'utf8');
const resultsText = fs.readFileSync(resultsPath, 'utf8');
const commandIds = [...new Set(
  resultsText
    .split(/\r?\n/)
    .map((line) => line.match(/^\|\s*([a-z][a-z0-9-]*)\s*\|/)?.[1])
    .filter((id) => id && id !== 'command-id'),
)];

const missingHandlers = [];
const missingWiring = [];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const id of commandIds) {
  const escaped = escapeRegExp(id);
  let hasHandler = new RegExp(`commandId === '${escaped}'`).test(appText);

  if (!hasHandler && /^nudge-(left|right|up|down)-(1|10)$/.test(id)) {
    hasHandler = /commandId\.startsWith\('nudge-'\)/.test(appText);
  }

  if (!hasHandler) {
    missingHandlers.push(id);
  }

  const quotedIdCount = [...appText.matchAll(new RegExp(`['"\`]${escaped}['"\`]`, 'g'))].length;
  const hasPatternWiring = /^nudge-(left|right|up|down)-(1|10)$/.test(id)
    && /runCommand\(`nudge-\$\{dirMap\[e\.key\]\}-\$\{amt\}`\)/.test(appText);

  if (quotedIdCount < 2 && !hasPatternWiring) {
    missingWiring.push(id);
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\..+$/, '')
  .replace('T', '-');
const reportPath = path.join(reportRoot, `command-audit-${timestamp}.txt`);
const latestReportPath = path.join(reportRoot, 'command-audit-latest.txt');
const ok = missingHandlers.length === 0 && missingWiring.length === 0;

const lines = [
  `COMMAND_AUDIT_TIMESTAMP=${timestamp}`,
  `APP_FILE=${appFile}`,
  `RESULTS_FILE=${resultsFile}`,
  `TOTAL_COMMANDS=${commandIds.length}`,
  `MISSING_HANDLERS=${missingHandlers.length}`,
  `MISSING_WIRING=${missingWiring.length}`,
  `AUDIT_STATUS=${ok ? 'PASS' : 'FAIL'}`,
  '',
];

if (missingHandlers.length) {
  lines.push('MISSING_HANDLER_COMMANDS:', ...missingHandlers.map((id) => `- ${id}`), '');
}

if (missingWiring.length) {
  lines.push('MISSING_WIRING_COMMANDS:', ...missingWiring.map((id) => `- ${id}`), '');
}

lines.push('ALL_COMMANDS:', ...commandIds.map((id) => `- ${id}`));

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'ascii');
fs.writeFileSync(latestReportPath, `${lines.join('\n')}\n`, 'ascii');

console.log(`Command audit report: ${path.relative(repoRoot, reportPath)}`);
console.log(`Command audit latest: ${path.relative(repoRoot, latestReportPath)}`);

process.exit(ok ? 0 : 1);
