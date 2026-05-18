import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const binExt = process.platform === 'win32' ? '.cmd' : '';
const nodeExe = process.execPath;
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const builderBin = path.join(repoRoot, 'node_modules', 'electron-builder', 'cli.js');
const prepareScript = path.join(repoRoot, 'scripts', 'prepare-desktop-build.mjs');

function spawnLocal(commandPath, args) {
  if (process.platform !== 'win32' || path.extname(commandPath).toLowerCase() !== '.cmd') {
    return spawn(commandPath, args, { cwd: repoRoot, stdio: 'inherit' });
  }

  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandPath, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function run(commandPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawnLocal(commandPath, args);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(commandPath)} exited after signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${path.basename(commandPath)} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

if (!existsSync(viteBin)) {
  console.error(`vite was not found at ${viteBin}. Run npm install before building.`);
  process.exit(1);
}

if (!existsSync(builderBin)) {
  console.error(`electron-builder was not found at ${builderBin}. Run npm install before building.`);
  process.exit(1);
}

const cacheRoot = path.join(repoRoot, 'release', '.cache');
const electronCache = path.join(cacheRoot, 'electron');
const builderCache = path.join(cacheRoot, 'electron-builder');

mkdirSync(electronCache, { recursive: true });
mkdirSync(builderCache, { recursive: true });

try {
  await run(nodeExe, [prepareScript]);
  await run(nodeExe, [viteBin, 'build']);
  process.env.ELECTRON_CACHE = electronCache;
  process.env.ELECTRON_BUILDER_CACHE = builderCache;
  await run(nodeExe, [builderBin, ...process.argv.slice(2)]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
