const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repoRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(repoRoot, 'release');
const logPath = path.join(releaseDir, 'desktop-dev-launcher.log');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  try {
    fs.mkdirSync(releaseDir, { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch {
    // Console output is the important path; file logging is best effort.
  }
}

log('[FluxAura Studio] Loading desktop dev launcher...');

const launcherUrl = pathToFileURL(path.join(__dirname, 'start-desktop-dev.mjs')).href;

;(async () => {
  try {
    await import(launcherUrl);
  } catch (error) {
    log(`[FluxAura Studio] Launcher failed before startup: ${error?.stack || error?.message || error}`);
    process.exit(1);
  }
})();
