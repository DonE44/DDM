import fs from 'node:fs/promises'
import path from 'node:path'
import { parseMME, genMME } from '../src/utils/scaUtils.js'

const root = process.argv[2] || 'test-projects/recovery-mme'

function elementSig(el) {
  const media = el.mediaSourcePath || el.file || el.btnImageSourcePath || el.btnImage || ''
  const text = el.elLabel || el.mediaName || el.label || el.content || ''
  return {
    type: el.type || '',
    label: String(text).replace(/\s+/g, ' ').trim().slice(0, 120),
    media: path.basename(String(media || '')).toLowerCase(),
    x: Math.round(Number(el.x || 0)),
    y: Math.round(Number(el.y || 0)),
    w: Math.round(Number(el.w || 0)),
    h: Math.round(Number(el.h || 0)),
    z: Number(el.z || 0),
  }
}

function projectSig(parsed) {
  return {
    stage: parsed.stage ? { width: parsed.stage.width, height: parsed.stage.height } : null,
    pages: parsed.pages.map((page) => ({
      name: page.name || '',
      timing: {
        mode: page.timing?.mode || '',
        duration: page.timing?.duration || 0,
        onEnd: page.timing?.onEnd || '',
        onEndTarget: page.timing?.onEndTarget || '',
      },
      elements: (page.elements || [])
        .slice()
        .sort((a, b) => Number(a.z || 0) - Number(b.z || 0))
        .map(elementSig),
    })),
  }
}

async function checkFile(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  const first = parseMME(text)
  const roundtripText = genMME(first.pages, first.stage || undefined, {
    presentationAudio: first.presentationAudio,
    projectVars: first.projectVars,
  })
  const second = parseMME(roundtripText)
  const before = projectSig(first)
  const after = projectSig(second)
  return {
    filePath,
    ok: JSON.stringify(before) === JSON.stringify(after),
    warnings: (first.warnings?.length || 0) + (second.warnings?.length || 0),
    pages: first.pages.length,
    elements: first.pages.reduce((sum, page) => sum + (page.elements?.length || 0), 0),
  }
}

async function findMmeFiles(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue
      out.push(...await findMmeFiles(full))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mme')) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  const files = await findMmeFiles(root)
  const results = []
  for (const file of files) results.push(await checkFile(file))

  let failed = 0
  for (const result of results) {
    if (!result.ok) failed += 1
    const rel = path.relative(process.cwd(), result.filePath)
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${rel} (${result.pages} pages, ${result.elements} elements, warnings=${result.warnings})`)
  }
  if (failed) {
    console.error(`${failed} recovery MME round-trip check(s) failed`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
