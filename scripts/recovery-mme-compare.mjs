import fs from 'node:fs/promises'
import path from 'node:path'
import { parseMME } from '../src/utils/scaUtils.js'

const [leftPath = 'test-projects/recovery-mme/01-before-crash-working.mme', rightPath = 'test-projects/recovery-mme/02-after-crash-broken.mme', outPath = 'test-projects/recovery-mme/recovery-mme-compare.md'] = process.argv.slice(2)

function labelElement(el, idx) {
  const text = el.elLabel || el.mediaName || el.label || el.content || ''
  const short = String(text).replace(/\s+/g, ' ').trim().slice(0, 52)
  return `${el.type || 'element'} ${idx + 1}${short ? ` (${short})` : ''}`
}

function keyElement(el, idx) {
  const media = el.mediaSourcePath || el.file || el.btnImageSourcePath || el.btnImage || ''
  const text = el.elLabel || el.mediaName || el.label || el.content || ''
  void idx
  return [
    el.type || '',
    String(text).replace(/\s+/g, ' ').trim().slice(0, 80),
    path.basename(String(media || '')).toLowerCase(),
  ].join('|')
}

function pageElementMap(page) {
  const map = new Map()
  for (const [idx, el] of (page.elements || []).entries()) {
    const key = keyElement(el, idx)
    const rows = map.get(key) || []
    rows.push({ el, idx, label: labelElement(el, idx) })
    map.set(key, rows)
  }
  return map
}

function takeMatch(map, key) {
  const rows = map.get(key)
  if (!rows?.length) return null
  const row = rows.shift()
  if (!rows.length) map.delete(key)
  return row
}

function primitiveDiffs(left, right, fields) {
  const diffs = []
  for (const field of fields) {
    const a = left?.[field]
    const b = right?.[field]
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push(`${field}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`)
    }
  }
  return diffs
}

async function main() {
  const [leftText, rightText] = await Promise.all([
    fs.readFile(leftPath, 'utf8'),
    fs.readFile(rightPath, 'utf8'),
  ])
  const left = parseMME(leftText)
  const right = parseMME(rightText)
  const lines = []

  lines.push('# Recovery MME Compare')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Left: \`${leftPath}\``)
  lines.push(`Right: \`${rightPath}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Left pages: ${left.pages.length}`)
  lines.push(`- Right pages: ${right.pages.length}`)
  lines.push(`- Left elements: ${left.pages.reduce((sum, page) => sum + (page.elements?.length || 0), 0)}`)
  lines.push(`- Right elements: ${right.pages.reduce((sum, page) => sum + (page.elements?.length || 0), 0)}`)
  lines.push(`- Stage: ${left.stage?.width || '?'}x${left.stage?.height || '?'} -> ${right.stage?.width || '?'}x${right.stage?.height || '?'}`)
  lines.push(`- Parser warnings: ${left.warnings?.length || 0} -> ${right.warnings?.length || 0}`)
  lines.push('')

  const maxPages = Math.max(left.pages.length, right.pages.length)
  const pageRows = []
  const elementRows = []
  for (let pageIdx = 0; pageIdx < maxPages; pageIdx += 1) {
    const lp = left.pages[pageIdx]
    const rp = right.pages[pageIdx]
    if (!lp || !rp) {
      pageRows.push(`- Page ${pageIdx + 1}: ${lp?.name || '(missing)'} -> ${rp?.name || '(missing)'}`)
      continue
    }
    const pageDiffs = primitiveDiffs(lp, rp, [
      'name',
      'bgColor',
      'bgImage',
      'bgMediaSourcePath',
      'bgMediaName',
      'bgMediaKind',
      'lyricStart',
      'lyricEnd',
    ])
    const timingDiffs = primitiveDiffs(lp.timing || {}, rp.timing || {}, [
      'mode',
      'duration',
      'onEnd',
      'onEndTarget',
      'waitInputTrigger',
      'waitInputKey',
      'waitInputGoto',
    ])
    if (pageDiffs.length || timingDiffs.length || (lp.elements?.length || 0) !== (rp.elements?.length || 0)) {
      pageRows.push(`- ${lp.name || `Page ${pageIdx + 1}`}: ${[...pageDiffs, ...timingDiffs, `elements: ${lp.elements?.length || 0} -> ${rp.elements?.length || 0}`].join('; ')}`)
    }

    const leftMap = pageElementMap(lp)
    const rightMap = pageElementMap(rp)
    for (const [key, lrows] of leftMap.entries()) {
      for (const lrow of lrows) {
      const rrow = takeMatch(rightMap, key)
      if (!rrow) {
        elementRows.push(`- ${lp.name} / ${lrow.label}: missing from right comparison key`)
        continue
      }
      const diffs = primitiveDiffs(lrow.el, rrow.el, [
        'x',
        'y',
        'w',
        'h',
        'z',
        'file',
        'mediaSourcePath',
        'mediaKind',
        'mediaName',
        'content',
        'label',
        'action',
        'target',
        'linkTarget',
      ])
      if (lrow.idx !== rrow.idx) diffs.unshift(`order: ${lrow.idx} -> ${rrow.idx}`)
      if (diffs.length) {
        elementRows.push(`- ${lp.name} / ${lrow.label}: ${diffs.join('; ')}`)
      }
      }
    }
    for (const [, rrows] of rightMap.entries()) {
      for (const rrow of rrows) {
        elementRows.push(`- ${rp.name} / ${rrow.label}: added in right comparison key`)
      }
    }
  }

  lines.push('## Page Differences')
  lines.push('')
  if (pageRows.length) lines.push(...pageRows)
  else lines.push('- None')
  lines.push('')
  lines.push('## Element Differences')
  lines.push('')
  if (elementRows.length) lines.push(...elementRows)
  else lines.push('- None')
  lines.push('')

  await fs.writeFile(outPath, `${lines.join('\n')}\n`, 'utf8')
  console.log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
