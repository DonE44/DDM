import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const localBuilder = path.join(repoRoot, 'node_modules', 'electron-builder', 'cli.js');

if (!existsSync(localBuilder)) {
  console.error(`electron-builder was not found at ${localBuilder}. Run npm install before building.`);
  process.exit(1);
}

const cacheRoot = path.join(repoRoot, 'release', '.cache');
const electronCache = path.join(cacheRoot, 'electron');
const builderCache = path.join(cacheRoot, 'electron-builder');

mkdirSync(electronCache, { recursive: true });
mkdirSync(builderCache, { recursive: true });

const args = process.argv.slice(2);
const env = {
  ...process.env,
  ELECTRON_CACHE: electronCache,
  ELECTRON_BUILDER_CACHE: builderCache,
};

const command = process.execPath;
const commandArgs = [localBuilder, ...args];

const child = spawn(command, commandArgs, {
  cwd: repoRoot,
  env,
  shell: false,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`electron-builder exited after signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
