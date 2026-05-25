# TypeScript Strictness Plan

Goal: move FluxAura Studio toward `strict: true` without blocking V2 work or forcing a risky whole-app migration.

## Current State

- `forceConsistentCasingInFileNames` is enabled in `tsconfig.json` and `tsconfig.node.json`.
- `strict`, `noImplicitAny`, and `strictNullChecks` remain disabled.
- The app still relies on mixed `.jsx`, `.tsx`, and declaration files, with `// @ts-check` only on focused JavaScript modules.

## Phase 1 - Boundary Types First

- [ ] Tighten `window.smmDesktop` declarations for the APIs used by `App.jsx`, `HFTokenSettings.jsx`, whisper utilities, media import/export, and publish flows.
  - Started 2026-05-18: added typed HF legacy invoke overloads and narrowed `whisper.setHFToken`.
  - Continued 2026-05-18: declared exported-file saving, encrypted ZIP saving, system-font loading, Piper binary install, translation status/cancel, and streaming lyric export desktop APIs.
- [x] Keep CSS custom property support centralized in `src/types/css-vars.d.ts`; add local type casts only where values are genuinely dynamic.
  - Completed 2026-05-18: confirmed TSX custom properties use the central augmentation and added a local `CSSProperties` cast for the dynamic `--smm-stage-h` style in `App.jsx`.
- [ ] Align modal/component prop JSDoc with actual call sites before turning on additional compiler checks.
  - Started 2026-05-18: removed stale `stage` prop documentation from `ScriptFlowEditor.jsx`.
  - Continued 2026-05-18: aligned prop contracts for `PublishDialog.jsx`, `ScriptExportModal.jsx`, and `ImportPagesDialog.jsx`.
- [x] Add small helper typedefs for common page, element, media, and command payload shapes where they reduce repeated `any` usage.
  - Completed 2026-05-18: exported desktop helper/result payload types and replaced generic page/stage JSDoc in timeline, lyric timing, publish, script export, import, and publish utility surfaces with `SmmPage` / `SmmStage`.

## Phase 2 - JS Checkpoints

- [ ] Enable `checkJs` for one small directory at a time through file-level `// @ts-check`, starting with `src/utils`.
  - Started 2026-05-18: added `tsconfig.utils.json` and `npm run typecheck:utils` for a scoped utility checkpoint.
  - Started 2026-05-18: opted `colorUtils.js` and `chromaKey.js` into `// @ts-check`; existing checked utility files remain covered.
  - Continued 2026-05-19: opted `mediaRegistry.js`, `lyricAlignUtils.js`, and `systemFonts.js` into `// @ts-check`; `npm run typecheck:utils` remains green.
  - Continued 2026-05-19: enabled `checkJs: true` in `tsconfig.utils.json` for the full scoped utility checkpoint and re-ran `npm run typecheck:utils` (PASS).
- [ ] Fix surfaced null/undefined issues in utility modules before moving to components.
  - Started 2026-05-18: fixed readonly Xenova env writes in `whisperUtils.js` with a local mutable boundary helper.
- [ ] Avoid broad `@ts-ignore`; prefer narrowed typedefs or local guards.

## Phase 3 - Compiler Flags

- [ ] Enable `noImplicitAny` after boundary APIs and utility modules are clean.
- [ ] Enable `strictNullChecks` after modal/component props have been aligned.
- [ ] Enable `strict: true` only after the previous two flags pass in both app and node configs.

## Validation

- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run core:validate`.
- Record the validation report paths in `docs/command-test-master-todo.md` before marking this complete.

Latest validation checkpoint:

- Restart save point: `docs/restart-savepoint-20260518-231432.md`.
- 2026-05-18: `npm run lint` PASS.
- 2026-05-18: direct ESLint PASS after CSS custom-property typing update.
- 2026-05-18: direct ESLint PASS after publish/export/import prop-contract update.
- 2026-05-18: direct ESLint PASS after shared page/stage typedef update.
- 2026-05-18: `node scripts/core-validation.mjs release` PASS, `release/core-validation-20260518-220327.txt`.
- 2026-05-18: `npm run typecheck:utils` PASS after adding scoped utility checkpoint.
- 2026-05-18: `node scripts/core-validation.mjs release` PASS, `release/core-validation-20260518-221240.txt`.
- 2026-05-19: `npm run typecheck:utils` PASS after adding `// @ts-check` to `mediaRegistry.js`, `lyricAlignUtils.js`, and `systemFonts.js`.
- 2026-05-19: `node scripts/core-validation.mjs release` PASS, `release/core-validation-20260519-123812.txt`.
