# FluxAura Studio Hybrid Transcription Architecture Plan

## Goal

Keep FluxAura simple in the UI while supporting a professional hybrid stack:

- Auto Best
- Local Pro
- Fast Local
- Cloud Pro
- Manual / Paste Sync

Technical complexity stays behind those choices.

## 1. Proposed folder structure

```text
electron/
  transcription/
    transcription-service.cjs
    transcription-types.cjs
    transcription-debug.cjs
    transcription-model-discovery.cjs
    transcription-engine-catalog.cjs
    timing/
      timing-service.cjs
      timing-normalize.cjs
      lyric-alignment.cjs
    preprocess/
      audio-preprocess-service.cjs
      vocal-isolation-service.cjs
      demucs-runner.cjs
      preprocess-cache.cjs
    engines/
      engine-interface.cjs
      xenova-engine.cjs
      whispercpp-engine.cjs
      faster-whisper-engine.cjs
      openai-whisper-engine.cjs
      groq-whisper-engine.cjs
      engine-manager.cjs
```

Current files can be migrated incrementally:

- `electron/whisper-transcribe.cjs` remains the IPC entry point first.
- `electron/transcription-engines/xenova-engine.cjs` remains in place until engine files are moved.
- `electron/transcription-engines/whispercpp-engine.cjs` remains in place until the new service layer is introduced.

Renderer-side shape:

```text
src/
  features/transcription/
    transcriptionPresets.js
    transcriptionDebug.js
    transcriptionClient.js
    timingClient.js
```

## 2. Engine interface shape

Each engine should implement the same contract.

```js
/**
 * @typedef {{
 *   preset: 'auto-best'|'local-pro'|'fast-local'|'cloud-pro',
 *   engineId: 'xenova'|'whispercpp'|'faster-whisper'|'openai'|'groq',
 *   modelHint?: string|null,
 *   language?: string|null,
 *   wordTimestamps: boolean,
 *   transcriptionMode: 'normal'|'lyric-vocal-focus',
 *   sectionStartSec?: number|null,
 *   sectionEndSec?: number|null,
 *   preprocessedAudioPath?: string|null,
 *   originalAudioPath?: string|null,
 *   debug?: boolean,
 * }} TranscriptionRequest
 *
 * @typedef {{
 *   ok: boolean,
 *   engine: string,
 *   preset: string,
 *   model?: string|null,
 *   modelPath?: string|null,
 *   text: string,
 *   chunks: Array<{ start:number, end:number, text:string }>,
 *   wordTimestamps: Array<{ start:number, end:number, text:string }>,
 *   language?: string,
 *   warnings?: string[],
 *   quality?: {
 *     poor: boolean,
 *     reasons: string[],
 *     firstStart: number,
 *     wordCount: number,
 *     segmentCount: number,
 *   },
 *   debug?: Record<string, unknown>,
 *   error?: string,
 * }} TranscriptionResult
 */
```

Required engine methods:

- `isAvailable(context)`
- `discoverModels(context)`
- `transcribe(request, context)`
- `buildDebugPayload(request, result, context)`

The manager owns fallback logic. Engines do not call each other directly.

## 3. How models are discovered on disk

Introduce one discovery service that returns a normalized inventory.

Discovery sources:

- App-managed models directory under user data.
- Repository `electron/models/` for bundled or developer-provided assets.
- Existing `tools/`, `bin/`, `models/`, Desktop, Downloads, and app-data search roots already used by whisper.cpp.
- A dedicated `models/manifests/*.json` cache file later for faster startup.

Recommended discovery result shape:

```js
{
  engines: {
    xenova: [{ modelId, label, localPath, cached, sizeBytes }],
    whispercpp: [{ modelId, label, localPath, executablePath, cached }],
    fasterWhisper: [{ modelId, label, localPath, computeType, cached }],
    demucs: [{ modelId, label, localPath, cached }],
  },
  diagnostics: { searchedRoots, warnings }
}
```

Rules:

- Disk discovery must be read-only and side-effect free.
- Missing assets must never break transcription startup.
- The UI receives `available`, `installState`, and plain-language hints, not raw paths.

## 4. How user chooses engine in the Lyric Wizard

Keep the current simple UX, but route choices through presets instead of raw model ids.

Proposed visible choices:

- `Auto Best`
- `Local Pro`
- `Fast Local`
- `Cloud Pro`
- `Manual / Paste Sync`

Hidden preset mapping:

- `Auto Best`: try Local Pro if installed, otherwise Fast Local, otherwise current Xenova fallback, optionally Cloud Pro only if user enabled cloud fallback.
- `Local Pro`: Demucs vocal isolation, then Faster-Whisper.
- `Fast Local`: whisper.cpp first, Xenova fallback if whisper.cpp assets are missing.
- `Cloud Pro`: OpenAI Whisper API first, Groq later.
- `Manual / Paste Sync`: no transcription required unless user requests timing extraction.

Implementation note:

- Keep `WHISPER_MODELS` for compatibility during migration.
- Add `TRANSCRIPTION_PRESETS` for the wizard and Paste & Sync UI.
- The wizard should store a preset id, not a raw engine id.

## 5. How vocal isolation fits before transcription

Vocal isolation is a pre-processing stage, not a transcription engine.

Pipeline shape:

```text
input audio/video
  -> decode / extract audio
  -> optional vocal isolation
  -> selected transcription engine
  -> normalized timing output
```

Rules:

- Only `Local Pro` runs Demucs by default.
- `Auto Best` may enable isolation only when local assets are installed and the source looks musical.
- Isolation output should be cached per source file hash plus preset.
- If isolation fails, the manager falls back to the original audio without aborting the job.

## 6. How Paste & Sync uses the same timing engine

Paste & Sync should call the same timing extraction service used by transcription.

Shared rule:

- Every engine returns normalized `wordTimestamps` when possible.
- If an engine only returns segments, normalization expands them to words using the existing sentence-to-word fallback.

Target structure:

- `transcriptionService.transcribe()` returns transcript plus timing.
- `timingService.extractWordTiming()` can run without caring whether the caller wants a full transcript or pasted lyrics alignment.
- `alignLyricsToAudio()` remains a renderer utility initially, then can move under the timing service if desired.

This keeps Auto-Transcribe and Paste & Sync on the same timing rules and debug outputs.

## 7. How debug export works for every engine

Keep one debug export entry point in Electron.

Every debug bundle should include:

- request metadata: preset, engine selection, mode, section window, source path or URL
- preprocess metadata: whether vocal isolation ran, cache hit, output path, failure reason
- engine metadata: engine id, model id, model path, executable path if applicable
- output metadata: text, chunks, word timestamps, warnings, quality score, gap analysis
- environment metadata: discovered local assets and availability

The current `whisper:export-debug` IPC already exists and should remain the single writer.

## 8. Beta default engine

Default for beta testing: `Auto Best`.

Why:

- It preserves simplicity.
- It uses the strongest local route when available.
- It still keeps the current Xenova path alive for users who have not installed pro assets.
- It gives the team real-world signal on fallback frequency before forcing Local Pro on everyone.

Do not make `Cloud Pro` the beta default.

## 9. Step-by-step implementation phases

### Phase 1: Stabilize current abstraction

- Keep Xenova as-is.
- Keep whisper.cpp as-is.
- Add preset metadata and engine catalog.
- Unify debug payload fields.
- Unify Lyric Wizard and Paste & Sync around the same preset list.

### Phase 2: Introduce shared service layer

- Create `transcription-service.cjs` and move manager logic behind it.
- Move timing normalization into a shared timing module.
- Keep existing IPC names stable.

### Phase 3: Add Local Pro preprocessing

- Add Demucs runner and caching.
- Add preprocess metadata to debug export.
- Gate behind availability checks so missing Demucs never breaks transcription.

### Phase 4: Add Faster-Whisper engine

- Support local model discovery.
- Normalize output shape to existing chunk and word timestamp format.
- Wire `Local Pro` preset to Demucs -> Faster-Whisper.

### Phase 5: Preset-driven UI

- Change Lyric Wizard and Paste & Sync selectors from raw model ids to presets.
- Show plain-language availability text.
- Keep an advanced diagnostics view for support only.

### Phase 6: Optional cloud engines

- Keep OpenAI Whisper API behind `Cloud Pro`.
- Add Groq later under the same engine interface.
- Add explicit consent and API-key status UI.

### Phase 7: Retire direct UI dependence on Xenova model ids

- Keep Xenova as a supported engine.
- Remove renderer dependence on raw engine internals only after preset routing is stable.

## 10. Minimal first patch that improves reliability without breaking app

Recommended first patch:

- Add stricter local-input validation for whisper.cpp so it fails clearly when a native source path is unavailable.
- Expand debug export metadata so support bundles show request mode, preset intent, and local-engine context.

Why this patch first:

- It does not change the current user-visible flow.
- It does not remove Xenova.
- It reduces ambiguous failures in local-engine fallback.
- It helps diagnose beta issues before Demucs and Faster-Whisper land.

## Compatibility constraints

Do not break:

- narration / TTS
- media import
- audio preview
- video import
- publishing
- save / load

Transcription changes should stay contained to the current Electron transcription IPC surface and the Lyric Wizard / Whisper panel renderer surfaces.