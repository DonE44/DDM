# Command Test Results

Use this file to log command-by-command outcomes from docs/command-test-checklist.md.

## Run Metadata

- Date: 2026-04-23 (30-command baseline); expanded to full surface 2026-05-01; automated rerun 2026-05-18
- Tester: User manual verification (post-hardening) + T2 expansion
- App Version: 0.1.0
- Environment: Windows desktop build — Electron
- Notes: 30 commands verified post-2026-03-22 hardening patch. Full 83-command surface catalogued 2026-05-18 after nudge command audit coverage was added. UNTESTED entries need manual run.

## Automated Validation Snapshot

- Command coverage audit: PASS (83 handlers/pattern handlers, 83 wired) — see `release/command-audit-latest.txt`
- Core validation: CORE READY (15/15 checks passed) — see `release/core-validation-20260518-173603.txt`
- Lint: PASS (2026-05-18 rerun)
- Web build: PASS (2026-05-18 rerun)

## Results

| Command ID | Result (PASS/FAIL/UNTESTED) | Evidence / Repro Notes |
| --- | --- | --- |
| file-new | PASS | Manual run marked pass |
| file-open | PASS | Manual run marked pass |
| file-save | PASS | Manual run marked pass |
| file-export-html | PASS | Manual run marked pass |
| file-export-storybook | FAIL | **BUG FOUND + FIXED**: Zip produced corrupt/unknown-format archive (WinRAR reported damaged). Root cause: line 5196 passed `URL.createObjectURL(blob)` to `toBlobDownload()` which re-wrapped the URL string in `new Blob()`, producing a text file. Fix: replaced with direct anchor download (`a.href = objectURL; a.click(); revokeObjectURL`). Additional issues found same session: see rows below. |
| file-export-screen-png | UNTESTED | Needs manual run — exports current screen as PNG |
| file-export-page-png | UNTESTED | Needs manual run — exports current page canvas as PNG |
| file-export-script | UNTESTED | Needs manual run — exports .sca script file |
| file-import-pages | UNTESTED | Needs manual run — merges pages from .mme/.sca |
| file-import-pdf | UNTESTED | Needs manual run — imports PDF pages as storybook |
| file-print | UNTESTED | Needs manual run — opens print dialog |
| file-publish | UNTESTED | Needs manual run — publishes presentation |
| page-new | PASS | Manual run marked pass |
| page-duplicate | PASS | Manual run marked pass |
| page-delete | PASS | Manual run marked pass |
| page-prev | PASS | Verified post-2026-03-22 hardening patch |
| page-next | PASS | Verified post-2026-03-22 hardening patch |
| page-move-up | UNTESTED | Needs manual run — moves page earlier in order |
| page-move-down | UNTESTED | Needs manual run — moves page later in order |
| edit-undo | UNTESTED | Needs manual run — undo last edit |
| edit-redo | UNTESTED | Needs manual run — redo last undone edit |
| edit-copy | UNTESTED | Needs manual run — copies selected element(s) |
| edit-paste | UNTESTED | Needs manual run — pastes clipboard elements |
| edit-duplicate | UNTESTED | Needs manual run — duplicates selected element(s) with offset |
| edit-button | UNTESTED | Needs manual run — opens button editor for selected button |
| selection-duplicate | PASS | Manual run marked pass |
| selection-delete | PASS | Manual run marked pass |
| select-all | UNTESTED | Needs manual run — selects all elements on page |
| select-none | UNTESTED | Needs manual run — clears selection |
| layer-front | PASS | Verified post-2026-03-22 hardening patch |
| layer-up | PASS | Verified post-2026-03-22 hardening patch |
| layer-down | PASS | Verified post-2026-03-22 hardening patch |
| layer-back | PASS | Verified post-2026-03-22 hardening patch |
| align-left | UNTESTED | Needs manual run — aligns to left edge of stage |
| align-hcenter | UNTESTED | Needs manual run — aligns horizontally centre |
| align-right | UNTESTED | Needs manual run — aligns to right edge of stage |
| align-top | UNTESTED | Needs manual run — aligns to top edge of stage |
| align-vcenter | UNTESTED | Needs manual run — aligns vertically centre |
| align-bottom | UNTESTED | Needs manual run — aligns to bottom edge of stage |
| space-h | UNTESTED | Needs manual run — spaces elements evenly horizontally |
| space-v | UNTESTED | Needs manual run — spaces elements evenly vertically |
| nudge-left-1 | UNTESTED | Needs manual run — nudges selected element 1 px left |
| nudge-right-1 | UNTESTED | Needs manual run — nudges selected element 1 px right |
| nudge-up-1 | UNTESTED | Needs manual run — nudges selected element 1 px up |
| nudge-down-1 | UNTESTED | Needs manual run — nudges selected element 1 px down |
| nudge-left-10 | UNTESTED | Needs manual run — nudges selected element 10 px left |
| nudge-right-10 | UNTESTED | Needs manual run — nudges selected element 10 px right |
| nudge-up-10 | UNTESTED | Needs manual run — nudges selected element 10 px up |
| nudge-down-10 | UNTESTED | Needs manual run — nudges selected element 10 px down |
| group-selected | UNTESTED | Needs manual run — groups selected elements |
| ungroup-selected | UNTESTED | Needs manual run — ungroups selected group |
| view-spread | UNTESTED | Needs manual run — toggles spread/two-page view |
| view-script | PASS | Manual run marked pass |
| view-script-close | PASS | Manual run marked pass |
| view-variables | UNTESTED | Needs manual run — toggles variable editor panel |
| view-close-overlays | PASS | Verified post-2026-03-22 hardening patch |
| view-shortcuts | UNTESTED | Needs manual run — toggles keyboard shortcuts overlay |
| view-panel-left | UNTESTED | Needs manual run — toggles left panel visibility |
| view-panel-right | UNTESTED | Needs manual run — toggles right panel visibility |
| view-panel-bottom | UNTESTED | Needs manual run — toggles bottom panel visibility |
| view-media-lib | UNTESTED | Needs manual run — toggles media library panel |
| view-grid-toggle | PASS | Verified post-2026-03-22 hardening patch; grid now visible on all bg colours (difference blend) |
| view-zoom-in | PASS | Verified post-2026-03-22 hardening patch |
| view-zoom-out | PASS | Verified post-2026-03-22 hardening patch |
| view-zoom-fit | UNTESTED | Needs manual run — fits stage to window |
| view-bg-image | PASS | Verified post-2026-03-22 hardening patch |
| play-start | PASS | Verified post-2026-03-22 hardening patch |
| play-stop | PASS | Verified post-2026-03-22 hardening patch |
| play-prev | PASS | Verified post-2026-03-22 hardening patch |
| play-next | PASS | Verified post-2026-03-22 hardening patch |
| play-loop-toggle | UNTESTED | Needs manual run — toggles presentation loop |
| play-ctrl-toggle | UNTESTED | Needs manual run — toggles player controls visibility |
| play-interactive | UNTESTED | Needs manual run — toggles interactive mode |
| play-fullscreen-toggle | UNTESTED | Needs manual run — toggles fullscreen launch |
| play-dev-mode | UNTESTED | Needs manual run — toggles dev mode |
| tool-select | PASS | Manual run marked pass |
| tool-text | PASS | Verified post-2026-03-22 hardening patch |
| tool-image | PASS | Verified post-2026-03-22 hardening patch |
| tool-button | PASS | Manual run marked pass |
| tool-wipe | UNTESTED | Needs manual run — switches inspector to Wipe/Transition tab |
| tool-mpeg | UNTESTED | Needs manual run — activates MPEG video tool |
| tool-hotspot | UNTESTED | Needs manual run — activates hotspot draw tool |
| tool-menubar | UNTESTED | Needs manual run — activates menu bar insert tool |

## Bug Fixes Applied (Test Session 1 — 2026-05-01)

| Bug | File | Fix Applied |
| --- | --- | --- |
| Storybook ZIP corrupt | `src/App.jsx` line 5196 | Replaced `toBlobDownload(URL.createObjectURL(blob),…)` with direct anchor download |
| Canvas/stage out of screen during Present | `src/App.css` | Changed `.presenter-overlay` from `justify-content: center` → `justify-content: flex-end` so controls bar anchors to bottom |
| Next/Prev buttons off canvas during Present | `src/App.css` | Same fix as above (controls were rendering at vertical center, not bottom) |
| VariableEditor branding wrong | `src/VariableEditor.tsx` lines 2 & 1224 | Changed "SOLUTIONS MultiMedia…" → "FLUXAURA FUSE — Visual Script Programming" |
| Piper TTS binary not found on Windows | `electron/piper-tts.cjs` line 96 | Changed Windows `exe` key from `'piper.exe'` → `'piper/piper.exe'` (zip extracts to `piper/piper/` subfolder) |

> **Piper note**: After this fix, previously-downloaded Piper binaries at `<userData>/piper/piper.exe` will no longer be detected as valid. Delete `<userData>/piper/` folder and re-download via the TTS panel.

## Summary

- Date: 2026-05-01 (manual baseline) + 2026-05-18 (automated rerun)
- Pass count: 30
- Fail count: 1 (`file-export-storybook` — fixed)
- Untested count: 45
- Total commands: 83
- Status: **PARTIAL (MANUAL) + CORE READY (AUTOMATED)** — 30/83 manually verified PASS; 53 commands still need manual testing; automated lint/build/audit/core validation rerun passed.
