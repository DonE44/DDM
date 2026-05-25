# Command Test Master TODO

Single checklist to confirm the recovered app behaves as expected after the Windows crash.

## Current Baseline

- Source of truth: docs/command-test-results.md
- Total commands: 83
- PASS recorded: 73
- FAIL recorded: 1
- UNTESTED: 9
- Automated health: command audit PASS, core validation PASS, build PASS, lint PASS

## Top TODOs (Added 2026-05-18)

### Current Savepoint (2026-05-20)

- Background removal / chroma key: manual PASS reported 2026-05-22 for video element background removal in Play/Present.
- Missing media resolver: manual PASS reported 2026-05-22 for partial folder resolution/reopen preserving located media and element positions/behaviours.
- Page timing: added `Wait for media to finish` timing mode plus H/M/S/MS duration controls. Manual PASS reported 2026-05-22 for page-audio minimum timing plus user/default fallback when no page audio exists.
- Page Background Sound selection with `.WAV`: manual FAIL reported 2026-05-22 because audio start was delayed and persisted onto the next page while "Keep audio playing on next page" was disabled. Fix applied to use one controlled presenter path and stop timers/audio on page changes; needs retest.

- [x] SmartColorPicker inline-style cleanup
  - Scope: Replace inline JSX `style={...}` usage in `src/components/SmartColorPicker.tsx` with class-based CSS where possible, and document justified dynamic styling that must remain.
  - Reason: Analyzer warnings (`no-inline-styles`) at multiple lines in SmartColorPicker.
  - Safety note: Refactor carefully to avoid changing picker layout, alpha behavior, swatch rendering, or portal positioning.
  - Result: Completed. No SmartColorPicker diagnostics reported after refactor.

- [ ] TypeScript config hardening (phased)
  - Scope: Enable `forceConsistentCasingInFileNames` in `tsconfig.json` and `tsconfig.node.json` first. (Completed)
  - Scope: Plan phased migration to `strict: true` in both configs with targeted fixes and checkpoints. (Completed 2026-05-18; see `docs/typescript-strictness-plan.md`.)
  - Next scope: Start Phase 1 by adding focused null/unknown boundary types around desktop APIs, generated CSS variables, and modal props before enabling stricter compiler flags.
  - Progress: Added a whitelisted legacy desktop `invoke` bridge for HF token IPC and typed its return shapes in `src/types/desktop-api.d.ts`.
  - Progress: Added missing desktop API declarations for export saving, encrypted ZIP saving, system fonts, Piper binary install, translation status/cancel, and streaming lyric export.
  - Progress: Confirmed CSS custom-property typing stays centralized in `src/types/css-vars.d.ts`; added a local `CSSProperties` cast for dynamic `--smm-stage-h` in `src/App.jsx`.
  - Progress: Removed stale `stage` prop documentation from `src/modals/ScriptFlowEditor.jsx`.
  - Progress: Aligned publish/export/import modal prop contracts with current App.jsx call sites.
  - Progress: Exported shared desktop helper/result payload types and replaced generic page/stage JSDoc with `SmmPage` / `SmmStage` in timeline, lyric timing, publish, export, import, and publish utility surfaces.
  - Progress: Added scoped utility typecheck gate (`tsconfig.utils.json`, `npm run typecheck:utils`) and opted `colorUtils.js` / `chromaKey.js` into `// @ts-check`.
  - Progress: Fixed utility typecheck errors in `whisperUtils.js` by isolating mutable Xenova env configuration in a local helper.
  - Progress: Opted `mediaRegistry.js`, `lyricAlignUtils.js`, and `systemFonts.js` into `// @ts-check`; `npm run typecheck:utils` remains PASS.
  - Progress: Enabled `checkJs: true` in `tsconfig.utils.json` for `src/utils/**/*.js`; `npm run typecheck:utils` remains PASS.
  - Next progress target: start addressing wider app-level strictness blockers in `App.jsx` and modal props while keeping `strict: false` globally.
  - Reason: Analyzer findings for `typescript-config/consistent-casing` and `typescript-config/strict`.
  - Safety note: Do not enable full strict mode in one step on this branch without a staged fix plan.

- [ ] FluxAura branding and model compliance cleanup
  - Scope: Remove user-facing old/proprietary product references and standardize visible project-format language on FluxAura `.mme`.
  - Scope: Keep only commercially usable local model options enabled by default; clearly label user-owned Hugging Face/OpenAI token/API-key access.
  - Progress: Added `docs/branding-and-model-compliance-plan.md`.
  - Progress: Replaced first batch of visible `.sca`/`.SCA` strings with `.mme` and changed ZIP README branding to FluxAura Studio.
  - Progress: Added MIT/commercial-use metadata to Piper voice catalog and added `en_US-lessac-high`.
  - Finding: Full Whisper/Piper/other model expansion is not complete yet; current app catalog is a safe first pass, not an all-models import.
  - Safety note: Do not remove legacy parser compatibility or rename the desktop preload bridge in the same pass as visible branding cleanup.
  - Next progress target: add a focused branding audit script with allowlisted internal compatibility terms, then expand free-commercial model catalogs from primary source lists in small verified batches.

- [ ] FluxAura Fuse / Variable Programming templates
  - Scope: Update interactive templates so they are editable FluxAura pages/elements with visible Fuse script logic instead of hard-coded one-off navigation.
  - Progress: Rebuilt the Quiz/Test template as a 10-question scored quiz using real starter questions, `quiz_score` variables, answer button scripts, and result-page Fuse scripts.
  - Verification: Vite trace build PASS and `npm run commands:audit` PASS after the quiz template rewrite.
  - Progress: Added dedicated `Correct Answer` and `Incorrect Answer` feedback pages for every quiz question. Correct answers advance to the next question/results; incorrect answers record an incorrect attempt and return the user to repeat the same question.
  - Progress: Added `quiz_wrong` tracking and result-page text so the quiz keeps both correct score and incorrect attempt count.
  - Verification: Vite trace build PASS and traced command audit PASS after the feedback/retry quiz update. Plain `npm run commands:audit` still hit the intermittent silent Windows `-1073741795` exit once, then the same audit command passed when run through Node tracing.
  - Manual result: Quiz/Test PASS in Play/Present after answer-routing correction.
  - Progress: Wired Memory Game card backs with Fuse scripts for flip, match/mismatch comparison, flip counter, pair counter, mismatch delay/reset, and Win-page navigation. Face cards now ignore clicks instead of accidentally advancing.
  - Verification: `npm run commands:audit`, `npm run typecheck:utils`, and `npm run build` PASS after Memory Game implementation.
  - Fix: Memory Game face cards now render when Fuse `SHOW element` overrides reveal elements that start hidden, so flipped cards can display their symbol/image and reach Win.
  - Verification: `npm run commands:audit` PASS, `npm run typecheck:utils` PASS, and traced Vite build PASS after the card reveal fix. Plain `npm run build` hit the known intermittent Windows `-1073741795` no-diagnostic exit first.
  - Manual result: Memory Game PASS in Play/Present.
  - Fix: Memory Game now shuffles its `mg_sym[]` card-symbol array each time the Play page starts, updates face-button labels from the shuffled variables, and sends `Play Again` straight back to a fresh randomized game.
  - Progress: Rebuilt the Interactive Puzzle template as a 3-digit vault-lock puzzle using editable FluxAura Fuse variables for dials, attempts, current guess, feedback, score, and saved best score.
  - Progress: Added dynamic wrong-answer hints, winner messaging, score calculation, and local best-score persistence through existing Fuse file blocks.
  - Verification: `npm run commands:audit` PASS, `npm run typecheck:utils` PASS, and traced Vite build PASS after the puzzle template rewrite. One traced build run first hit the known intermittent Windows `-1073741795` no-diagnostic exit.
  - Manual result: Interactive Puzzle PASS in Play/Present.
  - Progress: Added a new Maze Game template with editable FluxAura pages/elements, character choice, three levels, d-pad movement scripts, level progression, score/move tracking, saved best score, and winner messaging.
  - Verification: `npm run commands:audit` PASS, `npm run typecheck:utils` PASS, and traced Vite build PASS after adding Maze Game.
  - Note: Maze Game currently uses on-screen controls inside FluxAura Fuse. Browser-style keyboard event capture will need a future dedicated key-input block/runtime event hook.
  - Manual result: Maze Game PASS in Play/Present.
  - Manual result: Imported Maze Game, Interactive Puzzle, and Quiz/Test templates PASS after direct template import and `.mme` script/key-binding preservation fixes.
  - TODO: Add dedicated FluxAura Fuse key-input event block/runtime hook so templates can bind WASD, arrow keys, Enter, Escape, and custom keys without hidden JavaScript.
  - Progress: Added first page-level key-input implementation: Play/Present runs `page.keyBindings` before default keyboard navigation, Maze levels bind Arrow/WASD keys to the same Fuse movement scripts as the on-screen controls, and FluxAura Fuse now has an `On Key Press` page tab for editing those bindings.
  - Verification: `npm run commands:audit` PASS, `npm run typecheck:utils` PASS, and traced Vite build PASS after page-level key bindings.
  - Progress: Rebuilt the Lesson / Tutorial template as an editable FluxAura Fuse lesson flow with start/reset logic, two checkpoint questions, score/wrong tracking, progress feedback, completion page, and saved best score.
  - Verification: `npm run commands:audit` PASS, `npm run typecheck:utils` PASS, and traced Vite build PASS after the Lesson / Tutorial rewrite.
  - Progress: Expanded Lesson / Tutorial to 10 checkpoint questions with four answer options on seven checkpoints, `CORRECT` / `INCORRECT` two-button checks on three checkpoints, and per-answer correct/incorrect feedback messages.
  - Manual result: Lesson / Tutorial PASS in Play/Present after 10-checkpoint expansion.
  - Next progress target: continue with edit/page order manual command batch.

- [ ] Restore three-track audio timeline model
  - Scope: Recover the pre-crash authoring model with `PAGE AUDIO 1`, `PAGE AUDIO 2`, and `PRESENTATION AUDIO`.
  - Scope: `PAGE AUDIO 1` and `PAGE AUDIO 2` are page-bound narration/transcription tracks; `PRESENTATION AUDIO` continues across the script and is not affected by page timings or page inputs.
  - Acceptance: Pressing ESC/Stop in Play/Present stops all three audio paths, including presentation audio.
  - Acceptance: When a page timing is set to `NONE (no advance)`, the timeline displays that page duration as the total length of its page audio tracks.
  - Acceptance: Page audio clips can be moved along the timeline without changing unrelated element/media timing behavior.
  - Safety note: Preserve existing presentation audio playback, lyric/audio sync, page narration loading, page sound compatibility, `.mme` save/load, and published output behavior while restoring the clearer three-track UI.
  - Progress: Added `PAGE AUDIO 2` (`narration2`) to new pages, typed page data, `.mme` save/load metadata, media re-resolution, export asset bundling, and published player asset resolution.
  - Progress: Added inspector controls for `PAGE AUDIO 1` and `PAGE AUDIO 2`, plus timeline lanes for both tracks.
  - Progress: Page-audio clips can be dragged horizontally in the timeline; offsets are stored on the page audio tracks.
  - Progress: Timeline pages set to `NONE (no advance)` now display duration from the longest page-audio track extent.
  - Progress: Play/Present and exported/published runtimes now stop both page-audio tracks on page change/close, while presentation audio remains the separate persistent script-level track.
  - Correction: Page narration is clip-based, not whole-page text-based. Selected text block Piper output now appends a clip to chosen `PAGE AUDIO 1` or `PAGE AUDIO 2`, so title, passage, and dialogue clips can be staggered independently.
  - Progress: Added `pageAudioClips` for multiple clips per page across the editor model, timeline, `.mme` metadata, Play/Present, Storybook export, and published player export.
  - Correction: New Piper narration clips are now real page `clip` audio elements, visible in `PAGES & ELEMENTS` with normal hide/lock/layer controls. Timeline/Play/Present/export still support older `pageAudioClips` as a compatibility fallback.
  - Verification: `npm run build` PASS and `npm run commands:audit` PASS after converting new Piper narration output into page audio elements.
  - Progress: Timeline PAGE AUDIO clips now select/jump to their owning page, can be moved between PAGE AUDIO 1 and PAGE AUDIO 2, and clamp horizontally inside the owning page so page audio cannot leak onto another page by dragging.
  - Progress: Older `pageAudioClips` are migrated into hidden audio clip elements so they appear in `PAGES & ELEMENTS`; Re-sync Audio refreshes page-audio timing display without changing each page's timing mode.
  - Verification: Vite trace build PASS and `npm run commands:audit` PASS after page-audio timeline locking/lane-switch work.
  - Verification: `npm run build` PASS and `npm run commands:audit` PASS after implementation; `npm run typecheck:utils` still exits intermittently with Windows code `-1073741795` and no diagnostics, matching the earlier Node validation instability.
  - Next progress target: manual-test three-track audio behavior with real audio files before resuming the file/import-publish command batch.

## V2 Backlog Intake From External Plan (Added 2026-05-18)

Source checked: `D:\Documents\CODING SCALA\SMME V2 PLANS CODING 2026.txt`.

### Product / UX Feature Backlog

- [ ] Program branding and application icon
  - Scope: Replace generated/placeholder icons with final FluxAura branded icon assets across app, installer, Storybook export, and shortcuts.
  - Acceptance: Desktop app, installer, exported packages, and docs show consistent FluxAura branding.

- [ ] Menu button icons
  - Scope: Add clear iconography to menu/toolbar buttons using the app's existing icon library and visual language.
  - Acceptance: Common commands are recognizable at a glance without text crowding.

- [ ] MMP player
  - Scope: Define the target player format/runtime, then implement import/export or playback support as appropriate.
  - Scope: Fix the related publish suite together: HTML publish output hangs/does not open, `.mmp` publish is not implemented, and ZIP publish bundles fail Windows extraction with `0x80004005` on bundled JPG assets.
  - Acceptance: Test project can be played through the MMP path with documented limitations.
  - Acceptance: HTML, MMP, and ZIP publish outputs all open/extract reliably from the same test project.

- [ ] Layer grouping
  - Scope: Make grouped elements easier to create, select, move, reorder, and ungroup.
  - Acceptance: Group operations are reversible and covered in command/manual tests.

- [ ] Animated text and objects
  - Scope: Expand animation presets, timing controls, and preview behavior for text and media objects.
  - Acceptance: User can assign, preview, save, reopen, and export animations reliably.

- [ ] CapCut-inspired workflow review
  - Scope: Review CapCut-style timeline, media bin, effects, and interaction patterns for useful ideas that fit an authoring tool.
  - Acceptance: Produce an implementation shortlist, not a broad clone.

- [ ] Hotspot copy-from-selected-area workflow
  - Scope: Hotspot button creation should create a new element that visually copies the selected region/area.
  - Acceptance: Drawing or creating a hotspot from a selected area produces a new editable hotspot/button element with the expected copied appearance.

- [ ] AI assistant for script creation
  - Scope: Add an assistant workflow for drafting page scripts, button actions, and branching logic.
  - Acceptance: Generated scripts can be previewed, edited, and inserted without corrupting existing project state.

- [ ] User update mechanism
  - Scope: Define how desktop users discover updates, install new versions, and read release notes.
  - Acceptance: Users can check for updates from inside the app or through a documented release channel.

- [ ] Payment / passkey licensing system
  - Scope: Research and design a paid access flow with passkeys/license keys before implementation.
  - Acceptance: Documented licensing model with offline behavior, recovery path, and privacy/security notes.

- [ ] Monetized libraries and tiered feature model
  - Scope: Define BASIC, NOVICE, and PRO feature/library tiers without breaking saved projects.
  - Acceptance: Feature-gating plan lists included/excluded capabilities and migration rules.

### Engineering Backlog Not Already Covered Above

- [ ] Resolve remaining App.jsx type-check defects
  - Scope: Fix typed CSS mismatches, desktop API gaps, and prop/type API issues reported in the main editor flow.
  - Acceptance: `// @ts-check` surfaces no actionable editor diagnostics in the touched areas.

- [ ] Add real automated tests
  - Scope: Introduce focused unit/integration/E2E tests for save/open/export/publish and command boundary behavior.
  - Acceptance: Tests run through an npm script and cover at least one command batch currently marked manual-only.

- [ ] Upgrade validation scripts to behavioral correctness
  - Scope: Extend smoke checks beyond lint/build/launch into real side-effect assertions.
  - Acceptance: Validation fails when a command is wired but does not perform its expected action.

- [ ] Add regression tests for command statuses and boundary behavior
  - Scope: Use `docs/command-test-checklist.md` / results rows as a source of truth for expected command states.
  - Acceptance: Command status regressions can be caught without a full manual pass.

- [ ] Add stricter command audit
  - Scope: Verify actual function invocation and side effects, not just handler/string presence.
  - Acceptance: Audit reports which commands have side-effect evidence and which remain wiring-only.

- [ ] Script-flow reliability polish
  - Scope: Add deterministic trigger tests and UI diagnostics for branching/page trigger behavior.
  - Acceptance: Broken links, pending triggers, and unreachable paths are visible and testable.

- [ ] HF token/auth UX polish
  - Scope: Keep close behavior, validation states, and desktop API typings aligned as model access evolves.
  - Acceptance: HF panel handles stored, invalid, expired, cleared, and unavailable-token states cleanly.

## Active Session (2026-05-18)

- Session goal: Complete remaining 52 untested commands with PASS/FAIL and fix tasks.
- Restart save point: `docs/restart-savepoint-20260518-231432.md`.
- Baseline rerun before manual tests: PASS
  - command audit: `release/command-audit-20260518-202414.txt`
  - core validation: `release/core-validation-20260518-202323.txt`
- Post-backlog/typing rerun: PASS
  - lint: PASS
  - command audit: `release/command-audit-20260518-211442.txt`
  - core validation: `release/core-validation-20260518-213114.txt`
- Phase 1 typing checkpoint: PASS
  - lint: PASS
  - core validation: `release/core-validation-20260518-220327.txt`
- Phase 2 utility checkpoint: PASS
  - `npm run typecheck:utils`: PASS
  - lint: PASS
  - core validation: `release/core-validation-20260518-221240.txt`
- Phase 2 post-restart utility checkpoint: PASS
  - `npm run typecheck:utils`: PASS
  - lint: PASS
  - core validation: `release/core-validation-20260519-123812.txt`
- Recovery MME checkpoint:
  - Added recovery fixtures under `test-projects/recovery-mme`.
  - Added parser/media audit: `test-projects/recovery-mme/recovery-mme-audit.md`.
  - Extracted `MME TEST SCRIPTS.zip` to `test-projects/recovery-mme/_zip-mme-files` and audited it in `test-projects/recovery-mme/zip-mme-audit.md`.
  - Added before/after drift comparison: `test-projects/recovery-mme/recovery-mme-compare.md`.
  - Finding: recovery files parse cleanly; ZIP contains more `.mme` projects, not missing media assets; the crash pair mainly differs by element order/z and a few positions.

## Pre-Implementation Gate: Tests/Fixes Before Cross-Platform Editor Plan (Added 2026-05-23)

- [x] Adaptive performance tier foundation merged
  - Scope: Shared editor tier detection module plus published player runtime scaling.
  - Verification: `scripts/stable-validation.mjs` PASS on 2026-05-23 with `PASSED=16 FAILED=0 STATUS=CORE READY`.

- [ ] Re-run targeted manual publish checks (highest risk)
  - Scope: Validate `file-publish` outputs for HTML open behavior and ZIP extraction reliability on Windows.
  - Acceptance: Repro checklist added to `docs/command-test-results.md` and status updated with evidence.

- [ ] Close remaining command manual test gaps
  - Scope: Continue command checklist execution for currently untested commands and RETEST rows.
  - Acceptance: Each command row in `docs/command-test-results.md` is updated with PASS/FAIL/RETEST and repro notes.

- [ ] Stabilize intermittent Windows command exits (`-1073741795`) where still observed
  - Scope: Reproduce and isolate command/runtime conditions that still trigger no-diagnostic exits.
  - Acceptance: Add actionable repro + mitigation notes in `docs/windows-command-stability.md`.

- [ ] Cross-platform editor strategy kickoff prep
  - Scope: Finalize platform target split and technical path selection (Desktop Electron + Mobile web/PWA vs Capacitor shell vs web-first unification).
  - Acceptance: Add decision record with chosen path, tradeoffs, and phase milestones.

## User Priority Intake (Added 2026-05-23)

- [ ] P0 publish regression: HTML opens to blank blue screen
  - Scope: Ensure published HTML starts with the same visible pages/elements behavior as Play/Present.
  - Progress: Added publish resolver fallback for legacy/stale localhost media URLs (`?p=` decode) and added visible startup error overlay for publish runtime failures.
  - Verification: `scripts/stable-validation.mjs` PASS on 2026-05-23 (`PASSED=16 FAILED=0 STATUS=CORE READY`).
  - Next: Reproduce with your failing project and confirm whether the blank screen is resolved.

- [ ] Project media library architecture (grouped folders by type)
  - Scope: Define/import/export structure for project-local library groups: audio, video, fonts, wipes, buttons, templates, backgrounds, images, clips, palettes, icons, animations, animated buttons.
  - Acceptance: Media panel can map to grouped project folders and keep links portable.

- [ ] Large-project performance and memory optimization track
  - Scope: Improve behavior under high media counts and heavy graphics (decode, render, timeline, caching, previews).
  - Acceptance: Add measurable targets (load time, memory usage, frame stability) and benchmark scripts.

- [ ] Page timing UX docs: AUTO (timed advance)
  - Scope: Add clear user-facing explanation + examples for when/how AUTO timing advances pages.
  - Acceptance: Documented flow in user docs with at least three practical script examples.

- [ ] Modernize remaining templates beyond current dynamic set
  - Scope: Upgrade all non-modernized templates to demonstrate FluxAura capability and customization.
  - Scope: Add a guided tutorial template/script teaching users while building.
  - Acceptance: Templates remain editable and media-replaceable by users.

- [ ] Educational games template expansion
  - Scope: Add template concepts for match-up/memory variants, digital jigsaw, crosswords/word-search, and interactive boards/escape-room flows.
  - Constraint: If overlap with existing templates is uncertain, confirm with user before implementation.
  - Acceptance: Each template supports user media replacement and non-destructive customization.
  - Round-trip check: `node scripts\recovery-mme-roundtrip-check.mjs test-projects\recovery-mme` PASS for all 11 recovery fixtures, so parse/generate is not currently changing page count, element order, geometry, or z values.
- Current manual-test reconciliation:
  - 73 commands have PASS recorded.
  - 9 commands remain UNTESTED and need manual run.
  - 1 command is currently marked FAIL/deferred: `file-publish`.
  - `file-export-storybook` was stale in `docs/command-test-results.md`; reconciled to PASS because the fix/recheck is already recorded below.
- Fix checkpoint 2026-05-19:
  - Added undo checkpoints for align, spacing, nudge, layer ordering, group, and ungroup commands so layout edits undo one step at a time after imports.
  - Changed presenter scaling to measure the actual stage area instead of using a hard-coded control-bar height.
  - Verification: `npm run typecheck:utils`, `npm run commands:audit`, and `npm run build` PASS.
- Presenter background follow-up 2026-05-19:
  - Renamed the variable/script editor header to `FluxAura Fuse - Visual Script Programming`.
  - Changed presenter page background media from crop-style `cover` to stage-fit `fill` so page backgrounds match the editor canvas and are not cut off top/bottom.
  - Verification: `npm run build` PASS; `npm run typecheck:utils` PASS once, then later Node validation commands intermittently exited with Windows code `-1073741795` before reporting diagnostics.
  - Manual result: PASS reported by user for Play/Present page backgrounds.
- Next action: Continue down the remaining UNTESTED batches and log outcomes in docs/command-test-results.md. Publish is parked with MMP player/publish bundle work.

## Manual Testing Queue (Current)

Use `docs/command-test-results.md` as the source of truth while testing. For each command, change `UNTESTED` to `PASS` or `FAIL` and add short evidence.

### Test Next - Priority 1 File Safety And Data Flow

- [x] file-export-screen-png
- [x] file-export-page-png
- [x] file-export-script
- [x] file-import-pages
- [x] file-import-pdf
- [x] file-print
- [ ] file-publish — FAIL/deferred to MMP player/publish bundle work

### Current Fix Focus Before Next Manual Batch

- [x] Imported interactive templates preserve Fuse scripts, page key bindings, variables, and timing.
  - Repro: Maze/Puzzle templates loaded as new projects, saved, reopened/imported as `.mme`, then Play/Present loses Arrow/WASD movement and on-screen script-button behavior; page timing also appears changed.
  - Fix: Preserve button `script` arrays and page `keyBindings` in `.mme` metadata; add direct `Import Template…` flow so template pages/scripts can be inserted without save/open/import round-trip.
  - Manual result: Maze Game, Interactive Puzzle, Quiz/Test, and Memory Game PASS in Play/Present; Memory Game follow-up randomizes card placement on first play and Play Again.

### Then Continue - Remaining Manual Batches

- Edit/page order: PASS for `page-move-up`, `page-move-down`, `edit-undo`, `edit-redo`, `edit-copy`, `edit-paste`, `edit-duplicate`, `edit-button`, `select-all`, `select-none`.
- Layout commands: PASS for `align-*`, `space-*`, all `nudge-*`, `group-selected`, `ungroup-selected`.
- View commands: PASS for `view-spread`, `view-variables`, `view-shortcuts`, panel toggles, `view-media-lib`, `view-zoom-fit`.
- Playback toggles: `play-loop-toggle`, `play-ctrl-toggle`, `play-interactive`, `play-fullscreen-toggle`, `play-dev-mode`.
- Tool commands: `tool-wipe`, `tool-mpeg`, `tool-hotspot`, `tool-menubar`.

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

- [x] page-move-up
- [x] page-move-down
- [x] edit-undo
- [x] edit-redo
- [x] edit-copy
- [x] edit-paste
- [x] edit-duplicate
- [x] edit-button
- [x] select-all
- [x] select-none

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
- [x] nudge-up-1
- [x] nudge-down-1
- [x] nudge-left-10
- [x] nudge-right-10
- [x] nudge-up-10
- [x] nudge-down-10
- [x] group-selected
- [x] ungroup-selected

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
