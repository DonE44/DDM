# FluxAura Studio Branding And Model Compliance Plan

Created: 2026-05-19

## Goal

Keep FluxAura Studio commercially safe, brand-clean, and non-breaking:

- User-facing product name: `FluxAura Studio`.
- User-facing project format: `.mme`.
- No user-facing references to old/proprietary names such as SMME, Scala, Canva, or legacy `.sca` wording.
- Only expose bundled/downloadable local models whose licenses allow commercial app use.
- Token/API-key services must use the user's own account credentials and clearly label paid/gated access.

## Compatibility Rule

Do not remove legacy parser compatibility blindly. The app may still need to read older project text internally, but UI labels, docs, exports, and diagnostics should describe the format as FluxAura `.mme`.

Safe pattern:

- Public UI/docs: `.mme`.
- Internal parser comments/types may be migrated gradually.
- If old `.sca` import support remains, keep it hidden/compatibility-only and test `.mme` save/open after every change.

## Verified Model/Service Notes

### Piper TTS

- Source: `rhasspy/piper-voices` on Hugging Face.
- License: MIT.
- Commercial use: allowed under MIT.
- Current action: keep Piper voice entries limited to that MIT catalog and mark catalog entries with `license: 'MIT'` and `commercialUse: true`.
- Quality note: Piper voice samples define quality tiers up to `high`; prefer `high` where a voice exists.

### Local Whisper / Distil-Whisper

- OpenAI Whisper code and model weights are MIT.
- Distil-Whisper `distil-large-v3` is MIT and inherits the Whisper license.
- Commercial use: allowed under MIT.
- Current action: local free transcription models exposed by default should be MIT-compatible only.
- Future action: add Electron-only `distil-whisper/distil-large-v3` or `openai/whisper-large-v3-turbo` once the backend path is verified.

### Hugging Face Access

- Hugging Face tokens can be read/fine-grained and can access public, private, or gated repos the user is allowed to read.
- Gated models may require the user to request/accept access on Hugging Face before a token works.
- Current action: keep HF token support user-owned and read-only where possible.
- Policy: never bundle or enable a gated/restricted model unless its license is verified for commercial use.

### OpenAI API

- OpenAI transcription models are service/API models, not free local models.
- They are accessible with the user's OpenAI API key and account limits.
- Current implementation uses `whisper-1`.
- Future action: add explicit options for `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, and diarization only after request/response support is tested.

## Branding Cleanup Targets

Completed in this pass:

- Changed visible missing-media text from `.SCA` to `.mme`.
- Changed visible script/export/import checklist text from `.sca` to `.mme`.
- Changed ZIP bundle README label from `FluxAura Fuse` to `FluxAura Studio`.
- Added Piper commercial-use metadata and `en_US-lessac-high`.

Remaining targets:

- Replace remaining docs references to old names in historic TODO/savepoint files or mark them as archived history.
- Rename public-facing "SCA" parser comments and types to MME where safe.
- Decide whether to keep the internal `smmDesktop` bridge name as a compatibility API or migrate it behind a new `fluxAuraDesktop` alias.
- Rename `SmmPage`, `SmmStage`, and `ParsedSCA` types in a typed migration pass.
- Replace legacy `SMME_DEV_URL` fallback after confirming all dev scripts use `FLUXAURA_STUDIO_DEV_URL`.

## Safety Checklist

After each cleanup batch:

1. `node scripts\recovery-mme-roundtrip-check.mjs test-projects\recovery-mme`
2. `npm run typecheck:utils`
3. `npm run lint`
4. `npm run build`
5. Open a recovery `.mme`, save it, reopen it, and verify page/element order.

## Sources Checked

- Piper voice samples and quality tiers: https://rhasspy.github.io/piper-samples/
- Piper voices license: https://huggingface.co/rhasspy/piper-voices
- OpenAI Whisper MIT license/model table: https://github.com/openai/whisper
- Distil-Whisper MIT license: https://huggingface.co/distil-whisper/distil-large-v3
- Hugging Face user access tokens: https://huggingface.co/docs/hub/main/security-tokens
- Hugging Face gated models: https://huggingface.co/docs/hub/main/models-gated
- OpenAI speech-to-text API: https://platform.openai.com/docs/guides/speech-to-text
