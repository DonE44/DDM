#!/usr/bin/env node
/**
 * Generates icon assets (PNG) for FluxAura Studio from resources/icon.svg.
 * Run once after cloning or when the SVG source changes:
 *   npm run icons:generate
 *
 * Requires sharp (installed as devDependency):
 *   npm install --save-dev sharp
 */
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(import.meta.url)

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('\n❌  sharp not found. Install it first:\n    npm install --save-dev sharp\n')
  process.exit(1)
}

const resourcesDir = path.join(ROOT, 'resources')
if (!existsSync(resourcesDir)) mkdirSync(resourcesDir, { recursive: true })

const svgPath = path.join(resourcesDir, 'icon.svg')
if (!existsSync(svgPath)) {
  console.error(`\n❌  Source SVG not found: ${svgPath}\n`)
  process.exit(1)
}

const svgBuffer = readFileSync(svgPath)

await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(resourcesDir, 'icon.png'))
console.log('✓  resources/icon.png  (256×256)')

await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(resourcesDir, 'icon@2x.png'))
console.log('✓  resources/icon@2x.png  (512×512)')

await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(ROOT, 'public', 'favicon-32.png'))
console.log('✓  public/favicon-32.png  (32×32)')

console.log('\n✅  Icons generated.')
console.log('   For Windows production builds, electron-builder will convert')
console.log('   resources/icon.png → .ico automatically during packaging.\n')
