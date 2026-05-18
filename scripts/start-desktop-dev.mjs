import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const binExt = process.platform === 'win32' ? '.cmd' : '';
const nodeExe = process.execPath;
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCmd = path.join(repoRoot, 'node_modules', '.bin', `electron${binExt}`);
const releaseDir = path.join(repoRoot, 'release');
const viteOutLog = path.join(releaseDir, 'desktop-dev-vite.out.log');
const viteErrLog = path.join(releaseDir, 'desktop-dev-vite.err.log');
const devUrl = 'http://127.0.0.1:5173';

function requireLocalBin(commandPath, label) {
  if (!existsSync(commandPath)) {
    console.error(`${label} was not found at ${commandPath}. Run npm install first.`);
    process.exit(1);
  }
}

function waitForServer(url, child, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const check = () => {
      if (child.exitCode !== null) {
        reject(new Error(`Vite dev server exited before becoming ready (exit code ${child.exitCode}).`));
        return;
      }

      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error('Timed out waiting for Vite dev server on port 5173.'));
          return;
        }
        setTimeout(check, 500);
      });

      request.setTimeout(1000, () => {
        request.destroy();
      });
    };

    check();
  });
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

function spawnLocal(commandPath, args, options) {
  if (process.platform !== 'win32' || path.extname(commandPath).toLowerCase() !== '.cmd') {
    return spawn(commandPath, args, options);
  }

  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandPath, ...args], {
    ...options,
    shell: false,
  });
}

requireLocalBin(viteBin, 'vite');
requireLocalBin(electronCmd, 'electron');

console.log('[FluxAura Studio] Starting desktop dev launcher...');

mkdirSync(releaseDir, { recursive: true });
for (const logPath of [viteOutLog, viteErrLog]) {
  if (existsSync(logPath)) {
    rmSync(logPath, { force: true });
  }
}

const vite = spawnLocal(nodeExe, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort', '--force'], {
  cwd: repoRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

vite.on('error', (error) => {
  console.error(`[FluxAura Studio] Failed to start Vite: ${error.message}`);
});

vite.stdout.pipe(createWriteStream(viteOutLog, { flags: 'a' }));
vite.stderr.pipe(createWriteStream(viteErrLog, { flags: 'a' }));

let electronExitCode = 1;

try {
  await waitForServer(devUrl, vite);
  console.log(`[FluxAura Studio] Vite ready at ${devUrl} - launching Electron...`);

  const electronEnv = { ...process.env, FLUXAURA_STUDIO_DEV_URL: devUrl };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  const electron = spawnLocal(electronCmd, ['.'], {
    cwd: repoRoot,
    env: electronEnv,
    stdio: 'inherit',
  });

  electron.on('error', (error) => {
    console.error(`[FluxAura Studio] Failed to start Electron: ${error.message}`);
  });

  electronExitCode = await new Promise((resolve) => {
    electron.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[FluxAura Studio] Electron exited after signal ${signal}.`);
        resolve(1);
        return;
      }
      console.log(`[FluxAura Studio] Electron exited with code ${code ?? 0}.`);
      resolve(code ?? 0);
    });
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopProcessTree(vite);
}

process.exit(process.exitCode ?? electronExitCode);
