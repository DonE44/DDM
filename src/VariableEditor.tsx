// src/VariableEditor.jsx — Visual Variable & Script Editor
// FLUXAURA FUSE - Visual Script Programming
// FluxAura Studio scripting keywords: SET var, SHOW IF, REPEAT WHILE/UNTIL, GO TO (bookmark), RETURN, EXIT, WAIT, SET PROPERTY
//
// This file intentionally exports utility constants and functions alongside components (VAR_TYPES, SYSTEM_VARS,
// OPS, LOGIC_OPS, resolveVarRef, setVarRef, evalCondition, evalShowCondition, executeScript) because they are
// shared runtime helpers used by PresentationPlayer and App.jsx. Fast-refresh still works — the rule is suppressed.
import { useState, useCallback, useEffect, useRef } from 'react'

/* ─── Utilities ─────────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 10) }

/* ─── Data Definitions ──────────────────────────────────────────── */
export const VAR_TYPES = [
  { value: 'number',  label: 'Number',       icon: '123', color: '#4CAF50', placeholder: '0' },
  { value: 'text',    label: 'Text',         icon: 'Abc', color: '#2196F3', placeholder: 'hello' },
  { value: 'boolean', label: 'True / False', icon: '✓✗',  color: '#FF9800', placeholder: 'false' },
  { value: 'array',   label: 'Array',        icon: '[ ]', color: '#607d8b', placeholder: '[]' },
]

// System variables injected by PresentationPlayer at runtime
export const SYSTEM_VARS = [
  { name: 'DATE',        type: 'text',   desc: 'Current date (e.g. 2025-03-28)' },
  { name: 'TIME',        type: 'text',   desc: 'Current time (e.g. 14:30:05)' },
  { name: 'WEEKDAY',     type: 'text',   desc: 'Day name (e.g. Monday)' },
  { name: 'PAGE',        type: 'text',   desc: 'Current page name' },
  { name: 'PAGE_NUM',    type: 'number', desc: 'Current page number (1-based)' },
  { name: 'VISIT_COUNT', type: 'number', desc: 'How many times this page has been visited' },
  { name: 'TOTAL_PAGES', type: 'number', desc: 'Total number of pages' },
]

const BLOCK_CATS = [
  { id: 'variables', label: '📌 Variables', color: '#2e7d32', bgColor: '#1b5e20' },
  { id: 'control',   label: '🔀 Control',   color: '#e65100', bgColor: '#bf360c' },
  { id: 'timing',    label: '⏱ Timing',     color: '#00695c', bgColor: '#004d40' },
  { id: 'elements',  label: '🎬 Elements',   color: '#ad1457', bgColor: '#880e4f' },
  { id: 'navigate',  label: '➡ Navigate',   color: '#1565c0', bgColor: '#0d47a1' },
  { id: 'math',      label: '🎲 Math',       color: '#6a1b9a', bgColor: '#4a148c' },
  { id: 'storage',   label: '💾 Storage',    color: '#455a64', bgColor: '#263238' },
]

const BLOCK_DEFS = [
  // Variables
  { type: 'set-var',       cat: 'variables', label: 'SET variable',      color: '#2e7d32', icon: '📌', desc: 'Set a variable to a specific value' },
  { type: 'change-var',    cat: 'variables', label: 'CHANGE by',          color: '#388e3c', icon: '🔢', desc: 'Add/subtract/multiply/divide a number variable' },
  { type: 'reset-var',     cat: 'variables', label: 'RESET variable',     color: '#43a047', icon: '↺',  desc: 'Reset variable to its default value' },
  { type: 'string-set',    cat: 'variables', label: 'SET text (concat)',   color: '#1b5e20', icon: '🔤', desc: 'Set a text variable to a combination of values' },
  // Control
  { type: 'if-then',       cat: 'control',   label: 'IF / THEN / ELSE',   color: '#e65100', icon: '🔀', desc: 'Do different things based on a condition' },
  { type: 'repeat-while',  cat: 'control',   label: 'REPEAT WHILE',       color: '#bf360c', icon: '🔁', desc: 'Repeat blocks while a condition is true (FluxAura Studio: Repeat While)' },
  { type: 'repeat-until',  cat: 'control',   label: 'REPEAT UNTIL',       color: '#d84315', icon: '🔄', desc: 'Repeat blocks until a condition becomes true (FluxAura Studio: Repeat Until)' },
  { type: 'exit-script',   cat: 'control',   label: 'EXIT script',         color: '#b71c1c', icon: '🛑', desc: 'Stop executing this script immediately (FluxAura Studio: Exit from Script)' },
  // Timing
  { type: 'wait-sec',      cat: 'timing',    label: 'WAIT seconds',        color: '#00695c', icon: '⏳', desc: 'Pause the script for a number of seconds (FluxAura Studio: Pause in Seconds)' },
  { type: 'wait-click',    cat: 'timing',    label: 'WAIT for click',      color: '#00796b', icon: '🖱', desc: 'Pause until the user clicks anywhere (FluxAura Studio: Wait for Mouse)' },
  // Elements
  { type: 'show-el',       cat: 'elements',  label: 'SHOW element',        color: '#ad1457', icon: '👁', desc: 'Make an element visible' },
  { type: 'hide-el',       cat: 'elements',  label: 'HIDE element',        color: '#880e4f', icon: '🙈', desc: 'Make an element invisible' },
  { type: 'set-text',      cat: 'elements',  label: 'SET text content',    color: '#c2185b', icon: '✏️', desc: 'Change the text shown in a text element' },
  { type: 'set-opacity',   cat: 'elements',  label: 'SET opacity',         color: '#d81b60', icon: '🌓', desc: 'Change how transparent an element is (0–100)' },
  // Navigate
  { type: 'go-to',         cat: 'navigate',  label: 'GO TO page',          color: '#1565c0', icon: '➡', desc: 'Jump to a specific page' },
  { type: 'go-to-mark',    cat: 'navigate',  label: 'GO TO (bookmark)',     color: '#0d47a1', icon: '🔖', desc: 'Jump to a page and leave a bookmark to return (FluxAura Studio: Leave Bookmark)' },
  { type: 'return-mark',   cat: 'navigate',  label: 'RETURN to bookmark',  color: '#1a237e', icon: '↩', desc: 'Return to where the last bookmark was left (FluxAura Studio: Return to Bookmark)' },
  { type: 'next-page',     cat: 'navigate',  label: 'NEXT page',           color: '#1976d2', icon: '▶', desc: 'Go to the next page' },
  { type: 'prev-page',     cat: 'navigate',  label: 'PREV page',           color: '#0d47a1', icon: '◀', desc: 'Go to the previous page' },
  // Math
  { type: 'random',        cat: 'math',      label: 'RANDOM number',       color: '#6a1b9a', icon: '🎲', desc: 'Set a variable to a random integer between min and max' },
  // Variables - array support
  { type: 'set-array-item', cat: 'variables', label: 'SET array item',   color: '#1b5e20', icon: '📋', desc: 'Set arr[index] = value. Index can be a variable name.' },
  // Elements - image control
  { type: 'set-image',      cat: 'elements',  label: 'SET image source', color: '#6a1457', icon: '🖼', desc: 'Change the image displayed by a clip element (dynamic image)' },
  // Storage
  { type: 'file-open',      cat: 'storage',   label: 'OPEN file',        color: '#455a64', icon: '📂', desc: 'Open a persistent data file for Read or Write (stored in localStorage)' },
  { type: 'file-read-int',  cat: 'storage',   label: 'READ integer',     color: '#546e7a', icon: '📥', desc: 'Read an integer from an open file into a variable' },
  { type: 'file-write-int', cat: 'storage',   label: 'WRITE integer',    color: '#37474f', icon: '📤', desc: 'Write an integer variable value to an open file' },
  { type: 'file-close',     cat: 'storage',   label: 'CLOSE file',       color: '#263238', icon: '🔒', desc: 'Close an open file handle (data is auto-saved)' },
]

export const OPS = [
  { value: '==',  label: '= equals' },
  { value: '!=',  label: '≠ not equal' },
  { value: '>',   label: '> greater than' },
  { value: '<',   label: '< less than' },
  { value: '>=',  label: '≥ greater or equal' },
  { value: '<=',  label: '≤ less or equal' },
]

export const LOGIC_OPS = [
  { value: 'AND', label: 'AND (both true)' },
  { value: 'OR',  label: 'OR (either true)' },
]

const CHANGE_OPS = [
  { value: '+', label: '+ Add' },
  { value: '-', label: '− Subtract' },
  { value: '*', label: '× Multiply' },
  { value: '/', label: '÷ Divide' },
]

/* ─── Variable reference resolver (supports arr[idx] bracket notation) ── */
// Reads scriptVars[arr_idx] when ref is "arr[idx]" or "arr[3]"
export function resolveVarRef(ref, scriptVars) {
  if (!ref) return undefined
  const m = String(ref).match(/^(\w+)\[(.+)\]$/)
  if (m) {
    const idx = scriptVars[m[2]] !== undefined ? scriptVars[m[2]] : m[2]
    return scriptVars[`${m[1]}_${idx}`]
  }
  return scriptVars[ref]
}

// Writes scriptVars[arr_idx] when ref is "arr[idx]"
export function setVarRef(ref, value, scriptVars) {
  if (!ref) return
  const m = String(ref).match(/^(\w+)\[(.+)\]$/)
  if (m) {
    const idx = scriptVars[m[2]] !== undefined ? scriptVars[m[2]] : m[2]
    scriptVars[`${m[1]}_${idx}`] = value
  } else {
    scriptVars[ref] = value
  }
}

/* ─── Condition evaluator ────────────────────────────────────────── */
export function evalCondition(block, scriptVars) {
  const varVal = String(resolveVarRef(block.condVar ?? '', scriptVars) ?? '')
  const cmpVal = String(block.condVal ?? '')
  const op = block.condOp || '=='
  let result = false
  if (op === '==')  result = varVal === cmpVal
  else if (op === '!=')  result = varVal !== cmpVal
  else if (op === '>')   result = Number(varVal) > Number(cmpVal)
  else if (op === '<')   result = Number(varVal) < Number(cmpVal)
  else if (op === '>=')  result = Number(varVal) >= Number(cmpVal)
  else if (op === '<=')  result = Number(varVal) <= Number(cmpVal)

  // Second condition (AND / OR)
  if (block.condLogic && block.condVar2) {
    const v2 = String(resolveVarRef(block.condVar2 ?? '', scriptVars) ?? '')
    const c2 = String(block.condVal2 ?? '')
    const o2 = block.condOp2 || '=='
    let r2 = false
    if (o2 === '==')  r2 = v2 === c2
    else if (o2 === '!=')  r2 = v2 !== c2
    else if (o2 === '>')   r2 = Number(v2) > Number(c2)
    else if (o2 === '<')   r2 = Number(v2) < Number(c2)
    else if (o2 === '>=')  r2 = Number(v2) >= Number(c2)
    else if (o2 === '<=')  r2 = Number(v2) <= Number(c2)
    if (block.condLogic === 'AND') result = result && r2
    if (block.condLogic === 'OR')  result = result || r2
  }
  return result
}

/* ─── Script execution engine (async) ───────────────────────────── */
// Returns a Promise so WAIT blocks can pause execution.
// elCtrlFn(id, action, value) controls element properties at runtime.
// bookmarkRef is a { current: pageIdx } mutable reference.
export async function executeScript(blocks, scriptVars, pages, navigateFn, elCtrlFn, bookmarkRef) {
  if (!blocks || !blocks.length) return
  const MAX_REPEAT = 100  // infinite-loop safety
  for (const block of blocks) {
    switch (block.type) {

      case 'set-var':
        if (block.varName) {
          const val = resolveVarRef(String(block.value ?? ''), scriptVars)
          setVarRef(block.varName, val !== undefined ? val : block.value ?? '', scriptVars)
        }
        break

      case 'change-var': {
        if (!block.varName) break
        const cur = Number(resolveVarRef(block.varName, scriptVars) ?? 0)
        const amtRef = String(block.amount ?? '1')
        const amt = Number(resolveVarRef(amtRef, scriptVars) ?? amtRef)
        const op = block.op || '+'
        let result = cur
        if (op === '+') result = cur + amt
        else if (op === '-') result = cur - amt
        else if (op === '*') result = cur * amt
        else if (op === '/') result = amt !== 0 ? cur / amt : cur
        setVarRef(block.varName, result, scriptVars)
        break
      }

      case 'reset-var':
        if (block.varName && block._defaultValue !== undefined)
          scriptVars[block.varName] = block._defaultValue
        break

      case 'string-set':
        if (block.varName) {
          let val = String(block.template ?? '')
          // Replace {varName} and {arr[idx]} patterns
          val = val.replace(/\{([^}]+)\}/g, (_, ref) => {
            const resolved = resolveVarRef(ref, scriptVars)
            return resolved !== undefined ? String(resolved) : ''
          })
          setVarRef(block.varName, val, scriptVars)
        }
        break

      case 'random':
        if (block.varName) {
          const min = Number(block.min ?? 1)
          const max = Number(block.max ?? 10)
          scriptVars[block.varName] = Math.floor(Math.random() * (max - min + 1)) + min
        }
        break

      case 'set-array-item': {
        if (block.arrRef) {
          const rawVal = String(block.value ?? '')
          const resolved = resolveVarRef(rawVal, scriptVars)
          setVarRef(block.arrRef, resolved !== undefined ? resolved : rawVal, scriptVars)
        }
        break
      }

      case 'set-image':
        elCtrlFn?.(block.elLabel, 'set-image', block.imagePath ?? '')
        break

      case 'file-open':
        if (block.handleVar) scriptVars[block.handleVar] = block.fileName || ''
        break

      case 'file-read-int': {
        if (block.varName && block.handleVar) {
          const fname = scriptVars[block.handleVar] || block.handleVar
          try {
            const stored = localStorage.getItem(`mme_file_${fname}`)
            scriptVars[block.varName] = stored !== null ? parseInt(stored, 10) : 0
          } catch { scriptVars[block.varName] = 0 }
        }
        break
      }

      case 'file-write-int': {
        const fname = String(scriptVars[block.handleVar || ''] || block.handleVar || '')
        const rawWriteVal = String(block.writeVar || block.writeVal || '0')
        const writeVal = resolveVarRef(rawWriteVal, scriptVars) ?? rawWriteVal
        if (fname) {
          try { localStorage.setItem(`mme_file_${fname}`, String(Number(writeVal))) } catch { void 0 }
        }
        break
      }

      case 'file-close':
        // No-op — localStorage auto-persists
        break

      case 'if-then': {
        const condMet = evalCondition(block, scriptVars)
        const sub = condMet ? (block.thenBlocks || []) : (block.elseBlocks || [])
        if (sub.length) await executeScript(sub, scriptVars, pages, navigateFn, elCtrlFn, bookmarkRef)
        break
      }

      case 'repeat-while': {
        let iter = 0
        while (evalCondition(block, scriptVars) && iter < MAX_REPEAT) {
          await executeScript(block.loopBlocks || [], scriptVars, pages, navigateFn, elCtrlFn, bookmarkRef)
          iter++
        }
        break
      }

      case 'repeat-until': {
        let iter = 0
        do {
          await executeScript(block.loopBlocks || [], scriptVars, pages, navigateFn, elCtrlFn, bookmarkRef)
          iter++
        } while (!evalCondition(block, scriptVars) && iter < MAX_REPEAT)
        break
      }

      case 'exit-script':
        return  // stop processing this script entirely

      case 'wait-sec': {
        const ms = Math.max(0, Number(block.seconds ?? 1)) * 1000
        await new Promise(res => setTimeout(res, ms))
        break
      }

      case 'wait-click':
        await new Promise<void>(res => {
          const handler = () => { document.removeEventListener('click', handler, true); res() }
          document.addEventListener('click', handler, true)
        })
        break

      case 'show-el':
        elCtrlFn?.(block.elLabel, 'show')
        break

      case 'hide-el':
        elCtrlFn?.(block.elLabel, 'hide')
        break

      case 'set-text': {
        const rawTxt = String(block.textValue ?? '')
        const txt = rawTxt.replace(/\{([^}]+)\}/g, (_, ref) => {
          const resolved = resolveVarRef(ref, scriptVars)
          return resolved !== undefined ? String(resolved) : ''
        })
        elCtrlFn?.(block.elLabel, 'set-text', txt)
        break
      }

      case 'set-opacity':
        elCtrlFn?.(block.elLabel, 'set-opacity', Number(block.opacity ?? 100))
        break

      case 'go-to': {
        if (block.targetPage && navigateFn) {
          const idx = pages.findIndex(p => p.id === block.targetPage || p.name === block.targetPage)
          if (idx >= 0) navigateFn(idx)
        }
        break
      }

      case 'go-to-mark': {
        if (block.targetPage && navigateFn) {
          const idx = pages.findIndex(p => p.id === block.targetPage || p.name === block.targetPage)
          if (idx >= 0) {
            if (bookmarkRef) bookmarkRef.current = null  // will be set by navigator after jump
            navigateFn(idx, true /* leaveBookmark */)
          }
        }
        break
      }

      case 'return-mark':
        if (bookmarkRef?.current != null) navigateFn?.(bookmarkRef.current)
        break

      case 'next-page':
        navigateFn?.('next')
        break

      case 'prev-page':
        navigateFn?.('prev')
        break
    }
  }
}

/* ─── Show-condition evaluator (synchronous, for display control) ── */
export function evalShowCondition(cond, scriptVars) {
  if (!cond || cond.type !== 'if-cond') return true
  return evalCondition(cond, scriptVars)
}

/* ─── Sub-components ────────────────────────────────────────────── */

function VarPicker({ label, value, opts, onChange, allowFreeform = false }) {
  return (
    <div className="ve-field">
      {label && <label className="ve-lbl">{label}</label>}
      {allowFreeform ? (
        <input
          className="ve-inp"
          list="ve-var-datalist"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="variable or value…"
        />
      ) : (
        <select className="ve-sel" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— choose —</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  )
}

/* Reusable condition row (used by if-then, repeat-while, repeat-until, show-if) */
function ConditionRow({ block, varOpts, onChange, label = 'IF' }) {
  const upd = (field, val) => onChange({ ...block, [field]: val })
  const allOpts = [...(SYSTEM_VARS.map(sv => ({ value: sv.name, label: `⚙ ${sv.name} (${sv.type})` }))), ...varOpts]
  return (
    <div className="ve-condition-group">
      <div className="ve-condition-row">
        <span className="ve-cond-label">{label}</span>
        <select className="ve-sel ve-sel-var" value={block.condVar || ''} onChange={e => upd('condVar', e.target.value)}>
          <option value="">— variable —</option>
          {allOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="ve-sel ve-sel-op" value={block.condOp || '=='} onChange={e => upd('condOp', e.target.value)}>
          {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className="ve-inp ve-inp-val" value={block.condVal ?? ''} onChange={e => upd('condVal', e.target.value)} placeholder="value…" />
      </div>
      {/* Second condition (AND / OR) */}
      <div className="ve-cond-logic-row">
        <select className="ve-sel ve-sel-logic" value={block.condLogic || ''} onChange={e => upd('condLogic', e.target.value)}>
          <option value="">— (single condition) —</option>
          {LOGIC_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {block.condLogic && (
          <>
            <select className="ve-sel ve-sel-var" value={block.condVar2 || ''} onChange={e => upd('condVar2', e.target.value)}>
              <option value="">— variable —</option>
              {allOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="ve-sel ve-sel-op" value={block.condOp2 || '=='} onChange={e => upd('condOp2', e.target.value)}>
              {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className="ve-inp ve-inp-val" value={block.condVal2 ?? ''} onChange={e => upd('condVal2', e.target.value)} placeholder="value…" />
          </>
        )}
      </div>
    </div>
  )
}

function ScriptBlock({ block, vars, pages, elements, onChange, onDelete, onMoveUp, onMoveDown, depth = 0 }) {
  const def = BLOCK_DEFS.find(d => d.type === block.type)
  if (!def) return null

  const upd = (field, val) => onChange({ ...block, [field]: val })
  const varOpts = vars.map(v => ({ value: v.name, label: `${v.icon || ''} ${v.name} (${v.type})` }))
  const pageOpts = pages.map(p => ({ value: p.id, label: p.name || `Page ${p.id}` }))
  const elOpts = (elements || []).filter(e => e.elLabel).map(e => ({ value: e.elLabel, label: `${e.type === 'text' ? '🔤' : e.type === 'button' ? '🔘' : e.type === 'clip' ? '🖼' : '🎬'} ${e.elLabel}` }))

  return (
    <div className="ve-block" style={{ '--block-color': def.color, marginLeft: depth * 16 + 'px' }}>
      <div className="ve-block-header">
        <span className="ve-block-icon">{def.icon}</span>
        <span className="ve-block-type">{def.label}</span>
        <div className="ve-block-actions">
          {onMoveUp   && <button className="ve-block-act" onClick={onMoveUp}   title="Move up">↑</button>}
          {onMoveDown && <button className="ve-block-act" onClick={onMoveDown} title="Move down">↓</button>}
          <button className="ve-block-act ve-block-del" onClick={onDelete} title="Delete block">✕</button>
        </div>
      </div>

      <div className="ve-block-body">
        {block.type === 'set-var' && (
          <div className="ve-block-row">
            <VarPicker label="Variable" value={block.varName || ''} opts={varOpts} onChange={v => upd('varName', v)} />
            <div className="ve-field">
              <label className="ve-lbl">Set to value</label>
              <input className="ve-inp" list="ve-var-datalist" value={block.value ?? ''} onChange={e => upd('value', e.target.value)} placeholder="value or {varName}…" />
            </div>
          </div>
        )}

        {block.type === 'change-var' && (
          <div className="ve-block-row">
            <VarPicker label="Variable" value={block.varName || ''} opts={varOpts} onChange={v => upd('varName', v)} />
            <div className="ve-field">
              <label className="ve-lbl">Operation</label>
              <select className="ve-sel" value={block.op || '+'} onChange={e => upd('op', e.target.value)}>
                {CHANGE_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="ve-field">
              <label className="ve-lbl">Amount</label>
              <input className="ve-inp ve-inp-sm" list="ve-var-datalist" value={block.amount ?? 1} onChange={e => upd('amount', e.target.value)} />
            </div>
          </div>
        )}

        {block.type === 'reset-var' && (
          <VarPicker label="Variable to reset" value={block.varName || ''} opts={varOpts} onChange={v => upd('varName', v)} />
        )}

        {block.type === 'string-set' && (
          <div className="ve-block-row ve-block-col">
            <VarPicker label="Store result in" value={block.varName || ''} opts={varOpts.filter(v => vars.find(x => x.name === v.value)?.type === 'text' || true)} onChange={v => upd('varName', v)} />
            <div className="ve-field" style={{ flex: 3 }}>
              <label className="ve-lbl">Text template (use {'{varName}'} for variables)</label>
              <input className="ve-inp" value={block.template ?? ''} onChange={e => upd('template', e.target.value)} placeholder='Hello {playerName}! Score: {score}' />
            </div>
          </div>
        )}

        {block.type === 'if-then' && (
          <>
            <ConditionRow block={block} varOpts={varOpts} onChange={onChange} label="IF" />
            <SubScript label="✅ THEN do:" blocks={block.thenBlocks || []} vars={vars} pages={pages} elements={elements} onChange={b => upd('thenBlocks', b)} depth={depth + 1} />
            <SubScript label="❌ ELSE do:" blocks={block.elseBlocks || []} vars={vars} pages={pages} elements={elements} onChange={b => upd('elseBlocks', b)} depth={depth + 1} />
          </>
        )}

        {block.type === 'repeat-while' && (
          <>
            <ConditionRow block={block} varOpts={varOpts} onChange={onChange} label="WHILE" />
            <SubScript label="🔁 Repeat blocks:" blocks={block.loopBlocks || []} vars={vars} pages={pages} elements={elements} onChange={b => upd('loopBlocks', b)} depth={depth + 1} />
            <div className="ve-block-note">⚠ Max 100 iterations (infinite-loop safety)</div>
          </>
        )}

        {block.type === 'repeat-until' && (
          <>
            <ConditionRow block={block} varOpts={varOpts} onChange={onChange} label="UNTIL" />
            <SubScript label="🔄 Repeat blocks:" blocks={block.loopBlocks || []} vars={vars} pages={pages} elements={elements} onChange={b => upd('loopBlocks', b)} depth={depth + 1} />
            <div className="ve-block-note">⚠ Always runs at least once. Max 100 iterations.</div>
          </>
        )}

        {block.type === 'exit-script' && (
          <div className="ve-block-note">🛑 Script execution stops here immediately.</div>
        )}

        {block.type === 'wait-sec' && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">Seconds to wait</label>
              <input className="ve-inp ve-inp-sm" type="number" min="0" max="3600" step="0.1" value={block.seconds ?? 1} onChange={e => upd('seconds', e.target.value)} />
            </div>
            <div className="ve-block-note" style={{ alignSelf: 'flex-end' }}>Script pauses; other events continue.</div>
          </div>
        )}

        {block.type === 'wait-click' && (
          <div className="ve-block-note">🖱 Script pauses until the user clicks anywhere on screen. (FluxAura Studio: Wait for Mouse)</div>
        )}

        {(block.type === 'show-el' || block.type === 'hide-el') && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">Element label</label>
              {elOpts.length > 0 ? (
                <select className="ve-sel" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)}>
                  <option value="">— choose element —</option>
                  {elOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className="ve-inp" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)} placeholder="Label the element in the inspector first…" />
              )}
            </div>
            <div className="ve-block-note" style={{ alignSelf: 'flex-end' }}>Set element labels in Props &gt; Label</div>
          </div>
        )}

        {block.type === 'set-text' && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">Text element</label>
              {elOpts.filter(o => (elements||[]).find(e=>e.elLabel===o.value)?.type==='text').length > 0 ? (
                <select className="ve-sel" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)}>
                  <option value="">— choose text element —</option>
                  {elOpts.filter(o => (elements||[]).find(e=>e.elLabel===o.value)?.type==='text').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className="ve-inp" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)} placeholder="element label…" />
              )}
            </div>
            <div className="ve-field" style={{ flex: 2 }}>
              <label className="ve-lbl">New text (use {'{varName}'} for variables)</label>
              <input className="ve-inp" list="ve-var-datalist" value={block.textValue ?? ''} onChange={e => upd('textValue', e.target.value)} placeholder="Hello {playerName}!" />
            </div>
          </div>
        )}

        {block.type === 'set-opacity' && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">Element</label>
              {elOpts.length > 0 ? (
                <select className="ve-sel" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)}>
                  <option value="">— choose element —</option>
                  {elOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className="ve-inp" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)} placeholder="element label…" />
              )}
            </div>
            <div className="ve-field">
              <label className="ve-lbl">Opacity (0–100)</label>
              <input className="ve-inp ve-inp-sm" type="number" min="0" max="100" value={block.opacity ?? 100} onChange={e => upd('opacity', e.target.value)} />
            </div>
          </div>
        )}

        {(block.type === 'go-to' || block.type === 'go-to-mark') && (
          <div className="ve-block-row">
            <VarPicker label="Go to page" value={block.targetPage || ''} opts={pageOpts} onChange={v => upd('targetPage', v)} />
            {block.type === 'go-to-mark' && (
              <div className="ve-block-note" style={{ alignSelf: 'flex-end' }}>🔖 Leaves a bookmark — use RETURN TO BOOKMARK to come back.</div>
            )}
          </div>
        )}

        {block.type === 'return-mark' && (
          <div className="ve-block-note">↩ Returns to the page after the most recent GO TO (BOOKMARK).</div>
        )}

        {block.type === 'random' && (
          <div className="ve-block-row">
            <VarPicker label="Store result in" value={block.varName || ''} opts={varOpts} onChange={v => upd('varName', v)} />
            <div className="ve-field">
              <label className="ve-lbl">Min</label>
              <input className="ve-inp ve-inp-sm" type="number" value={block.min ?? 1} onChange={e => upd('min', e.target.value)} />
            </div>
            <div className="ve-field">
              <label className="ve-lbl">Max</label>
              <input className="ve-inp ve-inp-sm" type="number" value={block.max ?? 10} onChange={e => upd('max', e.target.value)} />
            </div>
          </div>
        )}

        {block.type === 'set-array-item' && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">Array reference (e.g. icon[x] or card[3])</label>
              <input className="ve-inp" list="ve-var-datalist" value={block.arrRef || ''} onChange={e => upd('arrRef', e.target.value)} placeholder="icon[x]…" />
            </div>
            <div className="ve-field">
              <label className="ve-lbl">Value or variable name</label>
              <input className="ve-inp" list="ve-var-datalist" value={block.value || ''} onChange={e => upd('value', e.target.value)} placeholder="value or variable…" />
            </div>
          </div>
        )}

        {block.type === 'set-image' && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">Element label</label>
              {elOpts.length > 0 ? (
                <select className="ve-sel" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)}>
                  <option value="">— choose element —</option>
                  {elOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className="ve-inp" value={block.elLabel || ''} onChange={e => upd('elLabel', e.target.value)} placeholder="element label…" />
              )}
            </div>
            <div className="ve-field" style={{ flex: 2 }}>
              <label className="ve-lbl">Image path / variable (supports {'{varName}'})</label>
              <input className="ve-inp" list="ve-var-datalist" value={block.imagePath || ''} onChange={e => upd('imagePath', e.target.value)} placeholder="artwork/image.png or {myImageVar}…" />
            </div>
          </div>
        )}

        {block.type === 'file-open' && (
          <div className="ve-block-row">
            <div className="ve-field">
              <label className="ve-lbl">File name (e.g. scores.txt)</label>
              <input className="ve-inp" value={block.fileName || ''} onChange={e => upd('fileName', e.target.value)} placeholder="scores.txt" />
            </div>
            <div className="ve-field">
              <label className="ve-lbl">Mode</label>
              <select className="ve-sel" value={block.mode || 'Read'} onChange={e => upd('mode', e.target.value)}>
                <option value="Read">Read</option>
                <option value="Write">Write</option>
              </select>
            </div>
            <VarPicker label="Store handle in" value={block.handleVar || ''} opts={varOpts} onChange={v => upd('handleVar', v)} />
          </div>
        )}

        {block.type === 'file-read-int' && (
          <div className="ve-block-row">
            <VarPicker label="File handle variable" value={block.handleVar || ''} opts={varOpts} onChange={v => upd('handleVar', v)} />
            <VarPicker label="Store result in" value={block.varName || ''} opts={varOpts} onChange={v => upd('varName', v)} />
            <div className="ve-block-note" style={{ alignSelf: 'flex-end' }}>Reads from persistent localStorage</div>
          </div>
        )}

        {block.type === 'file-write-int' && (
          <div className="ve-block-row">
            <VarPicker label="File handle variable" value={block.handleVar || ''} opts={varOpts} onChange={v => upd('handleVar', v)} />
            <div className="ve-field">
              <label className="ve-lbl">Variable or value to write</label>
              <input className="ve-inp" list="ve-var-datalist" value={block.writeVar || ''} onChange={e => upd('writeVar', e.target.value)} placeholder="hscore or 42…" />
            </div>
          </div>
        )}

        {block.type === 'file-close' && (
          <div className="ve-block-row">
            <VarPicker label="File handle variable" value={block.handleVar || ''} opts={varOpts} onChange={v => upd('handleVar', v)} />
            <div className="ve-block-note" style={{ alignSelf: 'flex-end' }}>🔒 Data is auto-saved to localStorage</div>
          </div>
        )}
      </div>
    </div>
  )
}

function SubScript({ label, blocks, vars, pages, elements, onChange, depth }) {
  const addBlock = type => onChange([...blocks, { id: uid(), type, thenBlocks: [], elseBlocks: [], loopBlocks: [] }])
  const updateBlock = (idx, b) => onChange(blocks.map((x, i) => i === idx ? b : x))
  const deleteBlock = idx => onChange(blocks.filter((_, i) => i !== idx))
  const moveBlock = (idx, dir) => {
    const arr = [...blocks]
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    onChange(arr)
  }

  return (
    <div className="ve-subscript" style={{ marginLeft: 12 }}>
      <div className="ve-subscript-label">{label}</div>
      {blocks.length === 0 && <div className="ve-subscript-empty">No blocks yet — add one below</div>}
      {blocks.map((b, i) => (
        <ScriptBlock
          key={b.id} block={b} vars={vars} pages={pages} elements={elements} depth={depth}
          onChange={upd => updateBlock(i, upd)}
          onDelete={() => deleteBlock(i)}
          onMoveUp={i > 0 ? () => moveBlock(i, -1) : null}
          onMoveDown={i < blocks.length - 1 ? () => moveBlock(i, 1) : null}
        />
      ))}
      <AddBlockMenu onAdd={addBlock} compact />
    </div>
  )
}

/* ─── Block Palette (always-visible sidebar) ─────────────────────── */
function BlockPalette({ onAdd }) {
  const [activeCat, setActiveCat] = useState(BLOCK_CATS[0].id)
  const [search, setSearch] = useState('')
  const [justAdded, setJustAdded] = useState(null)

  const filtered = BLOCK_DEFS.filter(d => {
    if (search) return d.label.toLowerCase().includes(search.toLowerCase()) || d.desc.toLowerCase().includes(search.toLowerCase())
    return d.cat === activeCat
  })

  function handleAdd(type) {
    onAdd(type)
    setJustAdded(type)
    setTimeout(() => setJustAdded(null), 600)
  }

  return (
    <div className="ve-palette">
      <div className="ve-palette-title">🧩 Block Palette</div>
      {/* Search */}
      <div className="ve-palette-search-wrap">
        <input
          className="ve-palette-search"
          placeholder="🔍 search blocks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="ve-palette-search-clr" onClick={() => setSearch('')}>✕</button>}
      </div>
      {/* Category tabs (only when not searching) */}
      {!search && (
        <div className="ve-palette-cats">
          {BLOCK_CATS.map(cat => (
            <button
              key={cat.id}
              className={`ve-palette-cat-btn ${activeCat === cat.id ? 've-palette-cat-active' : ''}`}
              style={{ '--cat-color': cat.color }}
              onClick={() => setActiveCat(cat.id)}
              title={cat.label}
            >
              <span>{cat.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}
      {search && <div className="ve-palette-search-hint">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>}
      {/* Block items */}
      <div className="ve-palette-items">
        {filtered.map(def => (
          <button
            key={def.type}
            className={`ve-palette-item ${justAdded === def.type ? 've-palette-item-flash' : ''}`}
            style={{ '--cat-color': def.color }}
            onClick={() => handleAdd(def.type)}
            title={def.desc}
          >
            <span className="ve-palette-item-icon">{def.icon}</span>
            <div className="ve-palette-item-text">
              <div className="ve-palette-item-label">{def.label}</div>
              <div className="ve-palette-item-desc">{def.desc}</div>
            </div>
            <span className="ve-palette-item-add">＋</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="ve-palette-empty">No blocks found</div>
        )}
      </div>
    </div>
  )
}

/* ─── Inline Add Block Button (used inside SubScript) ───────────── */
function AddBlockMenu({ onAdd, compact }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [activeCat, setActiveCat] = useState(BLOCK_CATS[0].id)
  const [search, setSearch] = useState('')
  const btnRef = useRef(null)

  function openMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(true)
  }

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function onOutside(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) {
        // Check if click was inside the fixed dropdown
        const dropdown = document.getElementById('ve-inline-dropdown')
        if (dropdown && dropdown.contains(e.target)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onOutside, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const filtered = BLOCK_DEFS.filter(d => {
    if (search) return d.label.toLowerCase().includes(search.toLowerCase())
    return d.cat === activeCat
  })

  return (
    <>
      <button
        ref={btnRef}
        className={`ve-add-btn ${compact ? 've-add-btn-compact' : ''}`}
        onClick={openMenu}
      >
        {compact ? '＋ Add block' : '＋ Add Script Block'}
      </button>

      {open && (
        <div
          id="ve-inline-dropdown"
          className="ve-inline-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          <div className="ve-inline-dd-header">
            <input
              className="ve-palette-search"
              placeholder="🔍 filter blocks…"
              value={search}
              autoFocus
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && filtered.length === 1) {
                  onAdd(filtered[0].type); setOpen(false); setSearch('')
                }
              }}
            />
          </div>
          <div className="ve-inline-dd-cats">
            {BLOCK_CATS.map(cat => (
              <button
                key={cat.id}
                className={`ve-palette-cat-btn ${activeCat === cat.id && !search ? 've-palette-cat-active' : ''}`}
                style={{ '--cat-color': cat.color }}
                onClick={() => { setActiveCat(cat.id); setSearch('') }}
                title={cat.label}
              >
                {cat.label.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="ve-inline-dd-items">
            {filtered.map(def => (
              <button
                key={def.type}
                className="ve-add-item"
                style={{ '--cat-color': def.color }}
                onClick={() => { onAdd(def.type); setOpen(false); setSearch('') }}
              >
                <span className="ve-add-item-pip" style={{ background: def.color }} />
                <div>
                  <div className="ve-add-item-label">{def.icon} {def.label}</div>
                  <div className="ve-add-item-desc">{def.desc}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="ve-palette-empty">No blocks match</div>}
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Variable Dashboard ────────────────────────────────────────── */
function VariableDashboard({ vars, onChange }) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState(null)

  function startAdd() {
    const nv = { id: uid(), name: '', type: 'number', defaultValue: '', description: '', color: '#4CAF50' }
    setDraft(nv)
    setEditId('new')
  }

  function startEdit(v) {
    setDraft({ ...v })
    setEditId(v.id)
  }

  function commitEdit() {
    if (!draft || !draft.name.trim()) return
    if (editId === 'new') {
      onChange([...vars, { ...draft, name: draft.name.trim() }])
    } else {
      onChange(vars.map(v => v.id === editId ? { ...draft, name: draft.name.trim() } : v))
    }
    setEditId(null); setDraft(null)
  }

  function cancelEdit() { setEditId(null); setDraft(null) }

  function deleteVar(id) {
    onChange(vars.filter(v => v.id !== id))
    if (editId === id) { setEditId(null); setDraft(null) }
  }

  const typeInfo = t => VAR_TYPES.find(x => x.value === t) || VAR_TYPES[0]

  return (
    <div className="ve-var-dashboard">
      <div className="ve-var-header">
        <span className="ve-var-title">📦 Project Variables</span>
        <button className="ve-var-add-btn" onClick={startAdd}>＋ New Variable</button>
      </div>

      {vars.length === 0 && editId !== 'new' && (
        <div className="ve-var-empty">
          No variables yet. Click <strong>＋ New Variable</strong> to define one.
        </div>
      )}

      <div className="ve-var-list">
        {vars.map(v => {
          const ti = typeInfo(v.type)
          return (
            <div key={v.id} className={`ve-var-chip ${editId === v.id ? 've-var-chip-editing' : ''}`}>
              <span className="ve-var-chip-type" style={{ background: ti.color }}>{ti.icon}</span>
              <span className="ve-var-chip-name">{v.name}</span>
              {v.type === 'array' && <span className="ve-var-size-badge">[{v.size ?? '?'}]</span>}
              <span className="ve-var-chip-default" title="Default value">{String(v.defaultValue ?? '')}</span>
              {v.description && <span className="ve-var-chip-desc" title={v.description}>ℹ</span>}
              <button className="ve-var-chip-btn" onClick={() => startEdit(v)} title="Edit">✎</button>
              <button className="ve-var-chip-btn ve-var-chip-del" onClick={() => deleteVar(v.id)} title="Delete">✕</button>
            </div>
          )
        })}
        {/* System variables — read-only, injected at runtime */}
        {SYSTEM_VARS.map(sv => (
          <div key={sv.name} className="ve-var-chip ve-var-chip-sys" title={sv.desc}>
            <span className="ve-var-chip-type" style={{ background: '#455a64' }}>⚙</span>
            <span className="ve-var-chip-name">{sv.name}</span>
            <span className="ve-var-chip-default" style={{ fontStyle: 'italic', color: '#78909c' }}>auto · {sv.type}</span>
            <span className="ve-var-chip-desc" style={{ marginLeft: 'auto', fontSize: 9 }}>{sv.desc}</span>
          </div>
        ))}

        {editId && draft && (
          <div className="ve-var-editor-form">
            <div className="ve-var-form-row">
              <div className="ve-field">
                <label className="ve-lbl">Variable Name *</label>
                <input
                  className="ve-inp"
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. score, playerName, isReady"
                  autoFocus
                />
              </div>
              <div className="ve-field">
                <label className="ve-lbl">Type</label>
                <select
                  className="ve-sel"
                  value={draft.type}
                  onChange={e => setDraft(d => ({ ...d, type: e.target.value, defaultValue: e.target.value === 'boolean' ? 'false' : e.target.value === 'number' ? '0' : '' }))}
                >
                  {VAR_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              {draft.type === 'array' && (
                <div className="ve-field">
                  <label className="ve-lbl">Array size (number of items)</label>
                  <input className="ve-inp ve-inp-sm" type="number" min="1" max="1000" value={draft.size ?? 10} onChange={e => setDraft(d => ({ ...d, size: Number(e.target.value) }))} />
                </div>
              )}
            </div>
            <div className="ve-var-form-row">
              <div className="ve-field">
                <label className="ve-lbl">Default Value</label>
                {draft.type === 'boolean' ? (
                  <select className="ve-sel" value={draft.defaultValue} onChange={e => setDraft(d => ({ ...d, defaultValue: e.target.value }))}>
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : (
                  <input
                    className="ve-inp"
                    type={draft.type === 'number' ? 'number' : 'text'}
                    value={draft.defaultValue}
                    onChange={e => setDraft(d => ({ ...d, defaultValue: e.target.value }))}
                    placeholder={typeInfo(draft.type).placeholder}
                  />
                )}
              </div>
              <div className="ve-field" style={{ flex: 2 }}>
                <label className="ve-lbl">Description (optional)</label>
                <input
                  className="ve-inp"
                  value={draft.description || ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="What is this variable for?"
                />
              </div>
            </div>
            <div className="ve-var-form-actions">
              <button className="ve-btn ve-btn-primary" onClick={commitEdit} disabled={!draft.name.trim()}>
                {editId === 'new' ? '＋ Create Variable' : '✓ Save Changes'}
              </button>
              <button className="ve-btn" onClick={cancelEdit}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Script Canvas ─────────────────────────────────────────────── */
function ScriptCanvas({ label, blocks, vars, pages, elements, onChange }) {
  const addBlock = type => onChange([...blocks, { id: uid(), type, thenBlocks: [], elseBlocks: [], loopBlocks: [] }])
  const updateBlock = (idx, b) => onChange(blocks.map((x, i) => i === idx ? b : x))
  const deleteBlock = idx => onChange(blocks.filter((_, i) => i !== idx))
  const moveBlock = (idx, dir) => {
    const arr = [...blocks]
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    onChange(arr)
  }

  const allVarNames = [...vars.map(v => v.name), ...SYSTEM_VARS.map(v => v.name)]

  return (
    <div className="ve-canvas-layout">
      {/* Left: Block Palette */}
      <BlockPalette onAdd={addBlock} />

      {/* Right: Script canvas */}
      <div className="ve-script-canvas">
        <datalist id="ve-var-datalist">
          {allVarNames.map(n => <option key={n} value={n} />)}
        </datalist>
        <div className="ve-canvas-header">
          <span className="ve-canvas-label">{label}</span>
          <span className="ve-canvas-count">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          {blocks.length > 0 && (
            <button
              className="ve-canvas-clear"
              onClick={() => { if (window.confirm('Clear all blocks from this script?')) onChange([]) }}
              title="Clear all blocks"
            >
              🗑 Clear
            </button>
          )}
        </div>

        {blocks.length === 0 && (
          <div className="ve-canvas-empty">
            <div className="ve-canvas-empty-icon">🧩</div>
            <div className="ve-canvas-empty-main">No blocks yet</div>
            <div className="ve-canvas-empty-hint">
              Click any block in the <strong>palette</strong> on the left to add it
            </div>
            {/* Quick-start suggestions */}
            <div className="ve-canvas-quick">
              <div className="ve-canvas-quick-label">Quick start:</div>
              {[
                { type: 'set-var',   label: '📌 Set a variable' },
                { type: 'if-then',   label: '🔀 If / Then branch' },
                { type: 'go-to',     label: '➡ Go to page' },
                { type: 'wait-sec',  label: '⏳ Wait seconds' },
              ].map(q => (
                <button key={q.type} className="ve-canvas-quick-btn" onClick={() => addBlock(q.type)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ve-canvas-blocks">
          {blocks.map((b, i) => (
            <ScriptBlock
              key={b.id} block={b} vars={vars} pages={pages} elements={elements}
              onChange={upd => updateBlock(i, upd)}
              onDelete={() => deleteBlock(i)}
              onMoveUp={i > 0 ? () => moveBlock(i, -1) : null}
              onMoveDown={i < blocks.length - 1 ? () => moveBlock(i, 1) : null}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Page Flow Map ─────────────────────────────────────────────── */
function PageFlowMap({ pages, curPageId, onSelectPage }) {
  // Build a simple adjacency list from page scripts and timing
  const getTargets = page => {
    const targets = new Set()
    const scan = blocks => {
      if (!blocks) return
      for (const b of blocks) {
        if (b.type === 'go-to' && b.targetPage) targets.add(b.targetPage)
        if (b.type === 'if-then') { scan(b.thenBlocks); scan(b.elseBlocks) }
      }
    }
    scan(page.onStartScript)
    scan(page.onEndScript)
    if (page.timing?.onEnd === 'goto' && page.timing?.onEndTarget) {
      const t = pages.find(p => p.name === page.timing.onEndTarget)
      if (t) targets.add(t.id)
    }
    return [...targets]
  }

  return (
    <div className="ve-flow-map">
      <div className="ve-flow-title">📋 Page Flow</div>
      <div className="ve-flow-pages">
        {pages.map((pg, i) => {
          const targets = getTargets(pg)
          const isActive = pg.id === curPageId
          return (
            <div key={pg.id} className={`ve-flow-node ${isActive ? 've-flow-node-active' : ''}`} onClick={() => onSelectPage(i)}>
              <div className="ve-flow-node-num">{i + 1}</div>
              <div className="ve-flow-node-name">{pg.name || `Page ${i + 1}`}</div>
              {targets.length > 0 && (
                <div className="ve-flow-node-arrows">
                  {(targets as string[]).map(tid => {
                    const ti = pages.findIndex(p => p.id === tid)
                    return ti >= 0 ? (
                      <span key={tid} className="ve-flow-arrow" title={`→ ${pages[ti].name || 'Page ' + (ti + 1)}`}>
                        →{ti + 1}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Variable Inspector (runtime panel) ────────────────────────── */
export function VarInspector({ vars, snapshot }) {
  if (!vars || vars.length === 0) return null
  const typeInfo = t => VAR_TYPES.find(x => x.value === t) || VAR_TYPES[0]

  return (
    <div className="ve-inspector">
      <div className="ve-inspector-title">Variables</div>
      {vars.map(v => {
        const cur = snapshot[v.name]
        const hasValue = cur !== undefined
        const ti = typeInfo(v.type)
        return (
          <div key={v.id} className={`ve-inspector-row ${hasValue ? 've-inspector-row-set' : ''}`}>
            <span className="ve-inspector-type" style={{ background: ti.color }}>{ti.icon}</span>
            <span className="ve-inspector-name">{v.name}</span>
            <span className="ve-inspector-val">{hasValue ? String(cur) : <em style={{ color: '#666' }}>{String(v.defaultValue ?? '')}</em>}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main VariableEditor Component ─────────────────────────────── */
export default function VariableEditor({ pages, setPages, projectVars, setProjectVars, curPageIdx, onClose }) {
  const [selectedPageIdx, setSelectedPageIdx] = useState(curPageIdx || 0)
  const [scriptTab, setScriptTab] = useState('start') // 'start' | 'end'

  const page = pages[selectedPageIdx]
  // Gather all labelled elements across the current page
  const pageElements = page?.elements?.filter(e => e.elLabel) || []

  const updatePageScript = useCallback((field, blocks) => {
    setPages(prev => prev.map((pg, i) =>
      i === selectedPageIdx ? { ...pg, [field]: blocks } : pg
    ))
  }, [selectedPageIdx, setPages])

  const startBlocks = page?.onStartScript || []
  const endBlocks   = page?.onEndScript   || []

  return (
    <div className="ve-overlay">
      <div className="ve-panel">
        {/* Header */}
        <div className="ve-header">
          <div className="ve-header-left">
            <span className="ve-header-logo">⚡</span>
            <span className="ve-header-title">Variable &amp; Script Editor</span>
            <span className="ve-header-sub">FLUXAURA FUSE — Visual Script Programming</span>
          </div>
          <div className="ve-header-right">
            <div className="ve-sys-vars-hint">
              <span>⚙ System vars: </span>
              {SYSTEM_VARS.map(sv => (
                <span key={sv.name} className="ve-sys-chip" title={sv.desc}>{sv.name}</span>
              ))}
            </div>
            <button className="ve-close-btn" onClick={onClose} title="Close [Esc]">✕ Close</button>
          </div>
        </div>

        {/* Variable Dashboard */}
        <VariableDashboard vars={projectVars} onChange={setProjectVars} />

        <div className="ve-workspace">
          {/* Left: Page selector */}
          <div className="ve-page-sidebar">
            <div className="ve-sidebar-title">📄 Pages</div>
            <div className="ve-page-list">
              {pages.map((pg, i) => (
                <button
                  key={pg.id}
                  className={`ve-page-btn ${i === selectedPageIdx ? 've-page-btn-active' : ''}`}
                  onClick={() => setSelectedPageIdx(i)}
                >
                  <span className="ve-page-num">{i + 1}</span>
                  <span className="ve-page-name">{pg.name || `Page ${i + 1}`}</span>
                  {((pg.onStartScript?.length || 0) + (pg.onEndScript?.length || 0)) > 0 && (
                    <span className="ve-page-badge">
                      {(pg.onStartScript?.length || 0) + (pg.onEndScript?.length || 0)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="ve-sidebar-sep" />

            {/* Help / Tips */}
            <div className="ve-tips">
              <div className="ve-tips-title">💡 Variable Programming Tips</div>
              <div className="ve-tip"><strong>SET</strong> a variable, then <strong>IF</strong> to branch</div>
              <div className="ve-tip"><strong>REPEAT WHILE</strong> loops until condition is false</div>
              <div className="ve-tip"><strong>WAIT</strong> pauses; <strong>EXIT</strong> stops the script</div>
              <div className="ve-tip"><strong>GO TO (bookmark)</strong> + <strong>RETURN</strong> = GOSUB</div>
              <div className="ve-tip"><strong>SHOW/HIDE</strong> element by its Label name</div>
              <div className="ve-tip">Use <strong>{'{'+'DATE'+'}'}</strong> in SET TEXT for live date</div>
              <div className="ve-tip">Per-element scripts: use ⚡ Script tab in inspector</div>
            </div>
          </div>

          {/* Center: Script Canvas */}
          <div className="ve-center">
            {page ? (
              <>
                <div className="ve-script-tabs">
                  <button
                    className={`ve-tab ${scriptTab === 'start' ? 've-tab-active' : ''}`}
                    onClick={() => setScriptTab('start')}
                  >
                    ▶ On Page Start
                    {startBlocks.length > 0 && <span className="ve-tab-badge">{startBlocks.length}</span>}
                  </button>
                  <button
                    className={`ve-tab ${scriptTab === 'end' ? 've-tab-active' : ''}`}
                    onClick={() => setScriptTab('end')}
                  >
                    ⏹ On Page End
                    {endBlocks.length > 0 && <span className="ve-tab-badge">{endBlocks.length}</span>}
                  </button>
                </div>

                {scriptTab === 'start' && (
                  <ScriptCanvas
                    label={`▶ Runs when "${page.name || 'this page'}" starts`}
                    blocks={startBlocks}
                    vars={projectVars}
                    pages={pages}
                    elements={pageElements}
                    onChange={b => updatePageScript('onStartScript', b)}
                  />
                )}
                {scriptTab === 'end' && (
                  <ScriptCanvas
                    label={`⏹ Runs when "${page.name || 'this page'}" ends (times out)`}
                    blocks={endBlocks}
                    vars={projectVars}
                    pages={pages}
                    elements={pageElements}
                    onChange={b => updatePageScript('onEndScript', b)}
                  />
                )}
              </>
            ) : (
              <div className="ve-no-page">Select a page on the left to edit its script</div>
            )}
          </div>

          {/* Right: Page Flow Map */}
          <PageFlowMap
            pages={pages}
            curPageId={page?.id}
            onSelectPage={setSelectedPageIdx}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Per-element Script Panel (embedded in inspector) ──────────── */
export function ElementScriptPanel({ el, pages, projectVars, allPageElements, onChange }) {
  const [trigger, setTrigger] = useState('click') // 'click' | 'hover' | 'showif'

  if (!el) return null

  const onClickScript  = el.onClickScript  || []
  const onHoverScript  = el.onHoverScript  || []
  const showCondition  = el.showCondition  || { type: 'if-cond', condVar: '', condOp: '==', condVal: '' }

  const allOpts = [
    ...(projectVars || []).map(v => ({ value: v.name, label: `${v.name} (${v.type})` })),
    ...SYSTEM_VARS.map(sv => ({ value: sv.name, label: `⚙ ${sv.name}` })),
  ]

  return (
    <div className="el-script-panel">
      <div className="el-script-trigger-tabs">
        <button className={`el-stab ${trigger === 'click' ? 'el-stab-active' : ''}`} onClick={() => setTrigger('click')}>
          🖱 On Click
          {onClickScript.length > 0 && <span className="ve-tab-badge">{onClickScript.length}</span>}
        </button>
        <button className={`el-stab ${trigger === 'hover' ? 'el-stab-active' : ''}`} onClick={() => setTrigger('hover')}>
          👆 On Hover
          {onHoverScript.length > 0 && <span className="ve-tab-badge">{onHoverScript.length}</span>}
        </button>
        <button className={`el-stab ${trigger === 'showif' ? 'el-stab-active' : ''}`} onClick={() => setTrigger('showif')}>
          👁 Show IF
        </button>
      </div>

      {trigger === 'click' && (
        <ScriptCanvas
          label="Runs when element is clicked"
          blocks={onClickScript}
          vars={projectVars || []}
          pages={pages || []}
          elements={(allPageElements || []).filter(e => e.elLabel)}
          onChange={b => onChange({ onClickScript: b })}
        />
      )}

      {trigger === 'hover' && (
        <ScriptCanvas
          label="Runs when mouse hovers over element"
          blocks={onHoverScript}
          vars={projectVars || []}
          pages={pages || []}
          elements={(allPageElements || []).filter(e => e.elLabel)}
          onChange={b => onChange({ onHoverScript: b })}
        />
      )}

      {trigger === 'showif' && (
        <div className="el-showif-panel">
          <div className="el-showif-title">👁 Show this element only IF…</div>
          <div className="ve-condition-group" style={{ padding: '8px 0' }}>
            <div className="ve-condition-row">
              <select className="ve-sel ve-sel-var" value={showCondition.condVar || ''} onChange={e => onChange({ showCondition: { ...showCondition, condVar: e.target.value } })}>
                <option value="">(always show)</option>
                {allOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="ve-sel ve-sel-op" value={showCondition.condOp || '=='} onChange={e => onChange({ showCondition: { ...showCondition, condOp: e.target.value } })}>
                {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input className="ve-inp ve-inp-val" value={showCondition.condVal ?? ''} onChange={e => onChange({ showCondition: { ...showCondition, condVal: e.target.value } })} placeholder="value…" />
            </div>
            <div className="el-showif-hint">
              {showCondition.condVar
                ? `Element is visible only when ${showCondition.condVar} ${showCondition.condOp} ${showCondition.condVal}`
                : 'No condition set — element is always visible'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
