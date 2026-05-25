import { spawn } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const binExt = process.platform === 'win32' ? '.cmd' : '';
const nodeExe = process.execPath;
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCmd = process.platform === 'win32'
  ? path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(repoRoot, 'node_modules', '.bin', `electron${binExt}`);
const releaseDir = path.join(repoRoot, 'release');
const launcherLog = path.join(releaseDir, 'desktop-dev-launcher.log');
const viteOutLog = path.join(releaseDir, 'desktop-dev-vite.out.log');
const viteErrLog = path.join(releaseDir, 'desktop-dev-vite.err.log');
const devUrl = 'http://127.0.0.1:5173';

function log(message, level = 'info') {
  const line = `[${new Date().toISOString()}] [start-desktop-dev] [${level}] ${message}`;
  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
  try {
    mkdirSync(releaseDir, { recursive: true });
    appendFileSync(launcherLog, `${line}\n`);
  } catch {
    // Best effort file logging only.
  }
}

function withoutElectronRunAsNode(env = process.env) {
  const cleanEnv = { ...env };
  for (const key of Object.keys(cleanEnv)) {
    if (key.toUpperCase() === 'ELECTRON_RUN_AS_NODE') {
      delete cleanEnv[key];
    }
  }
  return cleanEnv;
}

function requireLocalBin(commandPath, label) {
  if (!existsSync(commandPath)) {
    log(`${label} was not found at ${commandPath}. Run npm install first.`, 'error');
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

function removeLogIfPossible(logPath) {
  if (!existsSync(logPath)) return;
  try {
    rmSync(logPath, { force: true });
  } catch (error) {
    log(`[FluxAura Studio] Could not clear ${path.basename(logPath)}: ${error?.message || error}`, 'warn');
  }
}

function pipeToBestEffortLog(stream, logPath, label) {
  let logStream;
  try {
    logStream = createWriteStream(logPath, { flags: 'a' });
  } catch (error) {
    log(`[FluxAura Studio] Could not open ${label} log (${path.basename(logPath)}): ${error?.message || error}`, 'warn');
    return;
  }
  logStream.on('error', (error) => {
    log(`[FluxAura Studio] Could not write ${label} log (${path.basename(logPath)}): ${error?.message || error}`, 'warn');
    stream.unpipe(logStream);
  });
  stream.pipe(logStream);
}

process.on('uncaughtException', (error) => {
  log(`[FluxAura Studio] Uncaught exception: ${error?.stack || error?.message || error}`, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const details = reason?.stack || reason?.message || String(reason);
  log(`[FluxAura Studio] Unhandled rejection: ${details}`, 'error');
  process.exit(1);
});

requireLocalBin(viteBin, 'vite');
requireLocalBin(electronCmd, 'electron');

log('[FluxAura Studio] Starting desktop dev launcher...');

mkdirSync(releaseDir, { recursive: true });
for (const logPath of [viteOutLog, viteErrLog]) {
  removeLogIfPossible(logPath);
}

const vite = spawnLocal(nodeExe, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort', '--force'], {
  cwd: repoRoot,
  env: withoutElectronRunAsNode(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

vite.on('error', (error) => {
  log(`[FluxAura Studio] Failed to start Vite: ${error.message}`, 'error');
});

pipeToBestEffortLog(vite.stdout, viteOutLog, 'Vite stdout');
pipeToBestEffortLog(vite.stderr, viteErrLog, 'Vite stderr');

let electronExitCode = 1;

try {
  await waitForServer(devUrl, vite);
  log(`[FluxAura Studio] Vite ready at ${devUrl} - launching Electron...`);

  const electronEnv = { ...withoutElectronRunAsNode(), FLUXAURA_STUDIO_DEV_URL: devUrl };
  const electronArgs = [
    '.',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-dev-shm-usage',
    '--no-sandbox',
  ];

  if (process.platform === 'win32') {
    // Avoid noisy DirectComposition overlay probe errors on some Windows GPU drivers.
    electronArgs.push('--disable-direct-composition', '--disable-features=DirectComposition');
  }

  const electron = spawnLocal(electronCmd, electronArgs, {
    cwd: repoRoot,
    env: electronEnv,
    stdio: 'inherit',
  });

  log('[FluxAura Studio] Electron launched. Dev session is active; keep this terminal open while testing.');

  electron.on('error', (error) => {
    log(`[FluxAura Studio] Failed to start Electron: ${error.message}`, 'error');
  });

  electronExitCode = await new Promise((resolve) => {
    electron.on('exit', (code, signal) => {
      if (signal) {
        log(`[FluxAura Studio] Electron exited after signal ${signal}.`, 'error');
        resolve(1);
        return;
      }
      log(`[FluxAura Studio] Electron exited with code ${code ?? 0}.`);
      resolve(code ?? 0);
    });
  });
} catch (error) {
  log(error.message, 'error');
  process.exitCode = 1;
} finally {
  stopProcessTree(vite);
}

process.exit(process.exitCode ?? electronExitCode);
