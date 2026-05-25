# Recovery MME Comparison Files

Drop recent `.mme` files here for crash-recovery comparison.

Suggested filenames:

- `01-before-crash-working.mme`
- `02-after-crash-broken.mme`
- `03-feature-that-fails.mme`
- `04-export-or-media-problem.mme`

Optional notes file:

- `NOTES.md`

In `NOTES.md`, briefly write what each file should do and what currently goes wrong.

## Generated Recovery Reports

- `recovery-mme-audit.md`: parser/media summary for files in this folder.
- `zip-mme-audit.md`: parser/media summary for projects extracted from `MME TEST SCRIPTS.zip`.
- `recovery-mme-compare.md`: focused before/after crash comparison for `01-before-crash-working.mme` and `02-after-crash-broken.mme`.
- `scripts/recovery-mme-roundtrip-check.mjs`: round-trip guard for recovery `.mme` fixtures.

## Current Signal

- All recovery `.mme` files parse with zero parser warnings.
- `MME TEST SCRIPTS.zip` contains more `.mme` projects, not the missing PNG/MP4/WAV asset folders.
- The before/after crash pair has the same 4 pages and 33 elements.
- The main behavioral drift is element order/z changes, especially narration clips moving above/below text and artwork.
- Current parser/writer round-trips every recovery `.mme` fixture without changing pages, element order, geometry, or z values.
- Media paths still point to old absolute `C:\Users\base2jump\...` locations, so visual playback needs either the original asset folders or a resolver pass against copied media.

Useful commands:

```powershell
node scripts\recovery-mme-audit.mjs
node scripts\recovery-mme-audit.mjs 'test-projects\recovery-mme\_zip-mme-files' 'test-projects\recovery-mme\zip-mme-audit.md'
node scripts\recovery-mme-compare.mjs
node scripts\recovery-mme-roundtrip-check.mjs test-projects\recovery-mme
```
