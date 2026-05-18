# Command Test Master TODO

Single checklist to confirm the recovered app behaves as expected after the Windows crash.

## Current Baseline

- Source of truth: docs/command-test-results.md
- Total commands: 83
- COMPLETE before 13/05/2026: 31
- UNTESTED: 52
- Automated health: command audit PASS, core validation PASS, build PASS, lint PASS

## Active Session (2026-05-18)

- Session goal: Complete remaining 52 untested commands with PASS/FAIL and fix tasks.
- Baseline rerun before manual tests: PASS
  - command audit: `release/command-audit-20260518-202414.txt`
  - core validation: `release/core-validation-20260518-202323.txt`
- Next action: Execute Priority 1 file safety/data-flow commands and log outcomes in docs/command-test-results.md.

## Completed Before 13/05/2026

- [x] file-new
- [x] file-open
- [x] file-save
- [x] file-export-html
- [x] file-export-storybook
- [x] page-new
- [x] page-duplicate
- [x] page-delete
- [x] page-prev
- [x] page-next
- [x] selection-duplicate
- [x] selection-delete
- [x] layer-front
- [x] layer-up
- [x] layer-down
- [x] layer-back
- [x] view-script
- [x] view-script-close
- [x] view-close-overlays
- [x] view-grid-toggle
- [x] view-zoom-in
- [x] view-zoom-out
- [x] view-bg-image
- [x] play-start
- [x] play-stop
- [x] play-prev
- [x] play-next
- [x] tool-select
- [x] tool-text
- [x] tool-image
- [x] tool-button

## How To Use This TODO

1. Run the desktop app in the same environment used for release testing.
2. Work top to bottom.
3. For each item, mark PASS or FAIL and add short evidence.
4. If FAIL, add a concrete fix task under Fix Queue.
5. After each batch, update docs/command-test-results.md.

## Priority 0 - Recheck Previously Failed Item

- [x] file-export-storybook
  - Current state: Previously failed, fixed and already revalidated.
  - Verify now: Export opens and generated archive is valid and extractable.
  - Evidence: See docs/command-test-results.md and release/command-audit-latest.txt.
  - Result: PASS
  - If FAIL, add to Fix Queue.

## Priority 1 - File Safety And Data Flow

- [ ] file-export-screen-png
- [ ] file-export-page-png
- [ ] file-export-script
- [ ] file-import-pages
- [ ] file-import-pdf
- [ ] file-print
- [ ] file-publish

Expected: commands complete, output files are valid, and cancel paths show clear status.

## Priority 2 - Edit And Selection Reliability

- [ ] page-move-up
- [ ] page-move-down
- [ ] edit-undo
- [ ] edit-redo
- [ ] edit-copy
- [ ] edit-paste
- [ ] edit-duplicate
- [ ] edit-button
- [ ] select-all
- [ ] select-none

Expected: no crashes, no silent no-op, and boundaries handled with status messages.

## Priority 3 - Layout, Nudge, Group

- [ ] align-left
- [ ] align-hcenter
- [ ] align-right
- [ ] align-top
- [ ] align-vcenter
- [ ] align-bottom
- [ ] space-h
- [ ] space-v
- [ ] nudge-left-1
- [ ] nudge-right-1
- [ ] nudge-up-1
- [ ] nudge-down-1
- [ ] nudge-left-10
- [ ] nudge-right-10
- [ ] nudge-up-10
- [ ] nudge-down-10
- [ ] group-selected
- [ ] ungroup-selected

Expected: visible element movement/alignment, stable z-order, and group operations reversible.

## Priority 4 - View And Panel State

- [ ] view-spread
- [ ] view-variables
- [ ] view-shortcuts
- [ ] view-panel-left
- [ ] view-panel-right
- [ ] view-panel-bottom
- [ ] view-media-lib
- [ ] view-zoom-fit

Expected: toggles are idempotent and persist where intended.

## Priority 5 - Playback And Tooling

- [ ] play-loop-toggle
- [ ] play-ctrl-toggle
- [ ] play-interactive
- [ ] play-fullscreen-toggle
- [ ] play-dev-mode
- [ ] tool-wipe
- [ ] tool-mpeg
- [ ] tool-hotspot
- [ ] tool-menubar

Expected: playback state transitions are stable, controls reflect state, and tool activation is immediate.

## Pass Spot-Check (Already Marked PASS)

Run these after major fixes to catch regressions in core navigation/playback:

- [x] file-new
- [x] file-open
- [x] file-save
- [x] page-prev
- [x] page-next
- [x] layer-front
- [x] layer-up
- [x] layer-down
- [x] layer-back
- [x] view-grid-toggle
- [x] play-start
- [x] play-stop

## Fix Queue (Only Add Failing Items)

- [ ] Command:
  - Repro:
  - Suspected file:
  - Fix task:
  - Retest result:

- [ ] Command:
  - Repro:
  - Suspected file:
  - Fix task:
  - Retest result:

## Exit Criteria

- All 83 commands have explicit PASS or FAIL recorded.
- Every FAIL has a tracked fix task and a retest outcome.
- docs/command-test-results.md summary counts match row totals.
- Final rerun evidence files are recorded in release with latest timestamps.
