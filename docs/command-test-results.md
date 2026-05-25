# Command Test Results

Use this file to log command-by-command outcomes from docs/command-test-checklist.md.

## Run Metadata

- Date: 2026-04-23 (30-command baseline); expanded to full surface 2026-05-01; automated rerun 2026-05-18; audit rerun 2026-05-18 20:26
- Tester: User manual verification (post-hardening) + T2 expansion
- App Version: 0.1.0
- Environment: Windows desktop build — Electron
- Notes: Manual verification continued 2026-05-20 after PowerShell/Electron launch recovery. Full 83-command surface catalogued 2026-05-18 after nudge command audit coverage was added.

## Automated Validation Snapshot

- Command coverage audit: PASS (83 handlers/pattern handlers, 83 wired) — see `release/command-audit-latest.txt`
- Core validation: CORE READY (15/15 checks passed) — see `release/core-validation-20260518-202537.txt`
- Lint: PASS (2026-05-18 rerun)
- Web build: PASS (2026-05-18 rerun)

## Results

| Command ID | Result (PASS/FAIL/UNTESTED) | Evidence / Repro Notes |
| --- | --- | --- |
| file-new | PASS | Manual run marked pass |
| file-open | PASS | Manual PASS reconfirmed 2026-05-20 |
| file-save | PASS | Manual PASS reconfirmed 2026-05-20 |
| file-export-html | PASS | Manual run marked pass |
| file-export-storybook | PASS | **BUG FOUND + FIXED + REVALIDATED**: Zip produced corrupt/unknown-format archive (WinRAR reported damaged). Root cause: line 5196 passed `URL.createObjectURL(blob)` to `toBlobDownload()` which re-wrapped the URL string in `new Blob()`, producing a text file. Fix: replaced with direct anchor download (`a.href = objectURL; a.click(); revokeObjectURL`). Recheck is tracked as PASS in `docs/command-test-master-todo.md`. |
| file-export-screen-png | PASS | Manual PASS reported 2026-05-19 — saves readable full app window PNG |
| file-export-page-png | PASS | Manual PASS reported 2026-05-19 — saves readable current-page-only PNG without app chrome |
| file-export-script | PASS | Manual PASS reported 2026-05-19 — exports non-empty `.mme` project script |
| file-import-pages | PASS | Manual PASS reconfirmed 2026-05-20 — Import Script works for `.mme`; follow-up still needed for importing scripts from templates and confirming script behavior persists after import |
| file-import-pdf | PASS | Manual PASS reported 2026-05-20 — imports PDF pages as storybook |
| file-print | PASS | Manual PASS reported 2026-05-20 — opens print dialog |
| file-publish | FAIL | Manual FAIL reported 2026-05-20 — Publish HTML produces an output that does not open/hangs in browser; Publish `.mmp` is not implemented yet; Publish ZIP bundle creates archives Windows cannot reliably unpack (`0x80004005` on JPG assets such as `bg_p5` / `bg_p15`). Deferred to MMP player/publish bundle work. |
| page-new | PASS | Manual run marked pass |
| page-duplicate | PASS | Manual run marked pass |
| page-delete | PASS | Manual run marked pass |
| page-prev | PASS | Verified post-2026-03-22 hardening patch |
| page-next | PASS | Verified post-2026-03-22 hardening patch |
| page-move-up | PASS | Manual test PASS — selected page moved earlier in page order |
| page-move-down | PASS | Manual test PASS — selected page moved later in page order |
| edit-undo | PASS | Manual test PASS — undo restored previous edit state |
| edit-redo | PASS | Manual test PASS — redo reapplied undone edit |
| edit-copy | PASS | Manual test PASS — selected element copied |
| edit-paste | PASS | Manual test PASS — copied element pasted |
| edit-duplicate | PASS | Manual test PASS — selected element duplicated with offset |
| edit-button | PASS | Manual test PASS — selected button opened in button editor |
| selection-duplicate | PASS | Manual run marked pass |
| selection-delete | PASS | Manual run marked pass |
| select-all | PASS | Manual test PASS — selected all elements on current page |
| select-none | PASS | Manual test PASS — cleared current selection |
| layer-front | PASS | Verified post-2026-03-22 hardening patch |
| layer-up | PASS | Verified post-2026-03-22 hardening patch |
| layer-down | PASS | Verified post-2026-03-22 hardening patch |
| layer-back | PASS | Verified post-2026-03-22 hardening patch |
| align-left | PASS | Manual test PASS — selected elements aligned to left edge |
| align-hcenter | PASS | Manual test PASS — selected elements aligned to horizontal centre |
| align-right | PASS | Manual test PASS — selected elements aligned to right edge |
| align-top | PASS | Manual test PASS — selected elements aligned to top edge |
| align-vcenter | PASS | Manual test PASS — selected elements aligned to vertical centre |
| align-bottom | PASS | Manual test PASS — selected elements aligned to bottom edge |
| space-h | PASS | Manual test PASS — selected elements spaced evenly horizontally |
| space-v | PASS | Manual test PASS — selected elements spaced evenly vertically |
| nudge-left-1 | PASS | Manual test PASS — selected element nudged 1 px left |
| nudge-right-1 | PASS | Manual test PASS — selected element nudged 1 px right |
| nudge-up-1 | PASS | Manual test PASS — selected element nudged 1 px up |
| nudge-down-1 | PASS | Manual test PASS — selected element nudged 1 px down |
| nudge-left-10 | PASS | Manual test PASS — selected element nudged 10 px left |
| nudge-right-10 | PASS | Manual test PASS — selected element nudged 10 px right |
| nudge-up-10 | PASS | Manual test PASS — selected element nudged 10 px up |
| nudge-down-10 | PASS | Manual test PASS — selected element nudged 10 px down |
| group-selected | PASS | Manual test PASS — selected elements grouped |
| ungroup-selected | PASS | Manual retest PASS — selected group object now shows Ungroup control and ungroups correctly |
| view-spread | PASS | Manual test PASS — toggled spread/two-page view |
| view-script | PASS | Manual run marked pass |
| view-script-close | PASS | Manual run marked pass |
| view-variables | PASS | Manual test PASS — opened/toggled FluxAura Fuse variables editor |
| view-close-overlays | PASS | Verified post-2026-03-22 hardening patch |
| view-shortcuts | PASS | Manual test PASS — toggled keyboard shortcuts overlay |
| view-panel-left | PASS | Manual test PASS — toggled left Pages & Elements panel |
| view-panel-right | PASS | Manual test PASS — toggled right Properties panel |
| view-panel-bottom | PASS | Manual test PASS — toggled bottom timeline/panel |
| view-media-lib | PASS | Manual test PASS — toggled media library panel |
| view-grid-toggle | PASS | Verified post-2026-03-22 hardening patch; grid now visible on all bg colours (difference blend) |
| view-zoom-in | PASS | Verified post-2026-03-22 hardening patch |
| view-zoom-out | PASS | Verified post-2026-03-22 hardening patch |
| view-zoom-fit | PASS | Manual test PASS — fitted stage to available window |
| view-bg-image | PASS | Verified post-2026-03-22 hardening patch |
| play-start | PASS | Verified post-2026-03-22 hardening patch |
| play-stop | PASS | Verified post-2026-03-22 hardening patch |
| play-prev | PASS | Verified post-2026-03-22 hardening patch |
| play-next | PASS | Verified post-2026-03-22 hardening patch |
| play-loop-toggle | PASS | Manual PASS reported 2026-05-22 — presentation loop toggle behaves correctly. |
| play-ctrl-toggle | PASS | Manual PASS reported 2026-05-22 — player controls visibility toggle behaves correctly. |
| play-interactive | PASS | Manual PASS reported 2026-05-22 after fix — interactive mode suppresses unassigned global page-navigation keys while preserving assigned page key bindings/buttons. |
| play-fullscreen-toggle | RETEST | Manual check inconclusive 2026-05-22 — fullscreen/windowed difference was hard to confirm because project resolution and screen resolution are similar. Retest with a smaller stage or visible window border. |
| play-dev-mode | PASS | Manual PASS reported 2026-05-22 — dev mode toggle did not break playback. |
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
| Presenter page backgrounds cropped top/bottom | `src/App.jsx` | Changed presenter page background media from crop-style `cover` to stage-fit `fill`; user reported Play/Present PASS on 2026-05-19 |
| VariableEditor branding wrong | `src/VariableEditor.tsx` lines 2 & 1224 | Changed "SOLUTIONS MultiMedia…" → "FLUXAURA FUSE — Visual Script Programming" |
| Piper TTS binary not found on Windows | `electron/piper-tts.cjs` line 96 | Changed Windows `exe` key from `'piper.exe'` → `'piper/piper.exe'` (zip extracts to `piper/piper/` subfolder) |

> **Piper note**: After this fix, previously-downloaded Piper binaries at `<userData>/piper/piper.exe` will no longer be detected as valid. Delete `<userData>/piper/` folder and re-download via the TTS panel.

## Open Follow-Ups (Added 2026-05-20)

| Area | Status | Notes |
| --- | --- | --- |
| Page Background Sound `.WAV` playback | PASS | Manual PASS reported 2026-05-22 after routing page background sound through one controlled presenter audio path and stopping timers/audio on page change. |
| Video background removal in Play/Present | PASS | Manual PASS reported 2026-05-22 after latest `VideoChromaCanvas` presenter stabilization. |
| Missing media across multiple folders | PASS | Manual PASS reported 2026-05-22. Partial folder resolution/reopen preserved located media and element properties. |
| Page timing media-finish mode | PASS | Manual PASS reported 2026-05-22. `Pause (timed)` uses the user/default duration when no page audio exists, and page audio raises the minimum page duration while still allowing manual extension through the timeline or Timing editor. |
| Project reopen canvas fit | PASS | Manual PASS reported 2026-05-22 after reopen fit was changed to use the opened script's parsed stage size instead of stale pre-open dimensions; zoom controls/fit snapping use 5% increments. |

## Summary

- Date: 2026-05-01 (manual baseline) + 2026-05-18 (automated rerun) + 2026-05-20 (manual file-flow continuation)
- Pass count: 37
- Fail count: 1 (`file-publish` — deferred to MMP player/publish bundle work)
- Untested count: 45
- Total commands: 83
- Status: **PARTIAL (MANUAL) + CORE READY (AUTOMATED)** — 30/83 manually verified PASS; 52 commands still need manual testing; automated lint/build/audit/core validation rerun passed.
