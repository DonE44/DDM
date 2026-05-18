import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const nodeExe = process.execPath

const WINDOWS_ACCESS_VIOLATION = 3221225501
const steps = [
  {
    name: 'lint',
    args: ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings', '0'],
  },
  {
    name: 'build',
    args: ['node_modules/vite/bin/vite.js', 'build', '--debug'],
  },
  {
    name: 'commands:audit',
    args: ['scripts/command-audit.mjs', '--app-file', 'src/App.jsx', '--results-file', 'docs/command-test-results.md', '--report-dir', 'release'],
  },
  {
    name: 'core:validate',
    args: ['--trace-uncaught', 'scripts/core-validation.mjs', 'release'],
  },
]

function normalizeExitCode(code) {
  if (code == null) return 1
  return code < 0 ? 4294967296 + code : code
}

function runStep(step, attempt) {
  return new Promise((resolve) => {
    console.log(`\n[stable-validation] ${step.name} ${attempt > 1 ? `(retry ${attempt})` : ''}`)
    const child = spawn(nodeExe, step.args, {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      shell: false,
    })
    child.on('error', (error) => {
      console.error(`[stable-validation] ${step.name} failed to start: ${error.message}`)
      resolve(1)
    })
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[stable-validation] ${step.name} exited by signal ${signal}`)
        resolve(1)
        return
      }
      resolve(normalizeExitCode(code))
    })
  })
}

for (const step of steps) {
  let code = await runStep(step, 1)
  if (code === WINDOWS_ACCESS_VIOLATION) {
    console.warn(`[stable-validation] ${step.name} hit Windows access violation 0xC0000005. Retrying once sequentially...`)
    code = await runStep(step, 2)
  }
  if (code !== 0) {
    console.error(`[stable-validation] ${step.name} failed with exit code ${code}.`)
    process.exit(code > 255 ? 1 : code)
  }
}

console.log('\n[stable-validation] All checks passed.')
