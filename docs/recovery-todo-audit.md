# FluxAura Studio Recovery TODO Audit

Generated after the Windows 10 crash recovery pass.

## Current Validation Snapshot

- `npm.cmd run build`: PASS after changing Vite npm scripts to call `node node_modules/vite/bin/vite.js`.
- `npm.cmd run lint`: PASS after changing lint to call `node node_modules/eslint/bin/eslint.js`.
- `npm.cmd run commands:audit`: PASS, latest report in `release/command-audit-latest.txt`.
- `npm.cmd run core:validate`: PASS after replacing the stale PowerShell harness with `scripts/core-validation.mjs`; latest report `release/core-validation-20260518-161421.txt`.
- `npm.cmd run desktop:pack`: PASS on rerun; one earlier attempt failed inside Electron Builder's module collector with Windows code `3221225501`, so treat packaging as retry-sensitive on this machine.

## Explicit TODO / FIXME Search

- No application TODO or FIXME markers were found in `src` or `electron`.
- Remaining TODO/FIXME/HACK/XXX hits are from `scripts/todo-audit.mjs` itself.
- The major unresolved work is not marked as TODO in code; it is in manual command coverage and legacy naming.

## Direct Legacy / Branding Items

These are likely safe direct renames, but some may be compatibility identifiers and should be handled deliberately.

- `src/App.jsx`: `SMMScript View` visible label.
- `src/modals/ButtonEditorModal.tsx`: `SMMScript commands...` placeholder.
- `src/utils/scaUtils.js`: `!SMMScript` file header.
- `electron/main.cjs`: `SMME_DEV_URL` fallback environment variable.
- `electron/main.cjs`: open/save dialog titles and filters still say `MME Script`.
- `scripts/core-validation.ps1`, `scripts/prepare-desktop-build.ps1`, `scripts/prepare-desktop-dev.ps1`, `scripts/smoke-report.ps1`: legacy process cleanup includes `SMME` and `SMM200`.
- `electron/media-capabilities.cjs`: comment mentions `Scala clipart`.
- `src/utils/publishUtils.js`: internal exported HTML ids/classes use `smme-*`.
- `src/utils/systemFonts.js`: injected style id is `smme-system-fonts`.

Decision needed: whether `SMMScript`, `mme:` metadata comments, `.mme` file extension support, and `smme-*` internal HTML ids should remain for backward compatibility or be renamed with migration aliases.

## Manual Command Coverage Still Needed

The command audit says all 83 handlers are wired, but manual testing is incomplete:

- PASS: 30
- FAIL: 1 historical row, marked bug fixed
- UNTESTED: 52

Priority manual tests:

1. File export/import: PNG exports, script export, import pages, import PDF, print, publish.
2. Editing basics: undo, redo, copy, paste, duplicate, select all, select none.
3. Layout operations: align, space, nudge, group, ungroup.
4. Panel/view toggles: spread, variables, shortcuts, panel visibility, media library, zoom fit.
5. Playback toggles: loop, controls, interactive, fullscreen, dev mode.
6. Tool switching: wipe, MPEG, hotspot, menu bar.

## Broken / Risky Logic Found So Far

1. PowerShell/npm shim instability on this machine.
   - Fixed for `start`, `dev`, `start:web`, `build`, `preview`, `lint`, `desktop:pack`, and `desktop:build` where possible by using direct Node entrypoints.
   - `core:validate` now uses a Node harness.
   - Remaining risk: `commands:audit` and old smoke scripts still depend on PowerShell.

2. `core-validation.ps1` is stale.
   - Old reports still say `SMME Core Validation Report`.
   - Old reports looked for `release/win-unpacked/SMME.exe`.
   - It has been bypassed by `scripts/core-validation.mjs`, but the old file should be retired or updated later.

3. Export/player internals still use `smme-*` DOM ids/classes.
   - This may be harmless internal naming, but it conflicts with the rebrand goal.
   - Needs compatibility decision before changing because published HTML may depend on these ids.

4. Storybook export uses generated placeholder icons.
   - Current behavior is functional but not product-quality.
   - Replace with FluxAura branded icons or user-selected project icon.

5. Manual coverage gap.
   - 52 command rows are still marked `UNTESTED`, so the current running app cannot be considered fully regression-tested yet.

## Next Implementation Plan

1. Confirm naming policy for `SMMScript`, `.mme`, `mme:` comments, and `smme-*` internals.
2. Apply approved direct renames.
3. Continue beta-readiness hardening from `docs/beta-testing-guide.md`.
4. Re-run `npm.cmd run desktop:build` before release installer handoff.
5. Walk through the 52 untested command rows in small batches, updating `docs/command-test-results.md` after each batch.
6. Add smoke-test fixtures for save/open/export/publish so future crash recovery is less manual.
7. Retire or update legacy PowerShell validation/smoke scripts.
