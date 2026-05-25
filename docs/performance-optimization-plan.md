# Performance Optimization Plan (CPU/RAM/GPU Stability)

This plan focuses on keeping FluxAura responsive under heavy media and graphics workloads while reducing risks of RAM pressure and CPU freezes.

## Current Improvements Landed

- Publish runtime no longer re-queries karaoke words every animation frame.
  - Word spans are cached per page render.
- Toggle buttons are cached per page render.
  - State updates avoid repeated global DOM queries.
- Sequential validation now runs in a fast mode for build stats.
  - `FLUXAURA_FAST_VALIDATE=1` disables compressed-size calculations to reduce validation overhead.

## Priority 1: Runtime Hot-Path Protection

- Cache frequently used DOM lists in presenter and publish player loops.
- Avoid style writes when value did not change.
- Keep requestAnimationFrame loops minimal and skip work when media is paused.

Success metric:

- Lower main-thread scripting time in performance profiles during lyric playback.

## Priority 2: Media Memory Controls

- Proactively release hidden/off-page media resources:
  - pause audio/video,
  - clear `src` and call `load()` where safe,
  - remove detached media nodes.
- Add a soft cap for simultaneously preloaded clip media per page.
- Prefer streamed file references over huge inlined blobs during editing sessions.

Success metric:

- Reduced memory growth across long authoring sessions and multi-page playback loops.

## Priority 3: GPU and Render Throughput

- Limit expensive visual effects stacking on large text blocks (heavy shadows + filters + blend).
- Promote only truly animated nodes to compositing (`will-change`) and remove when idle.
- Provide an optional "Performance Mode" that downgrades non-critical effects while editing.

Success metric:

- Fewer frame drops on integrated GPUs and lower fan/noise under sustained playback.

## Priority 4: Build and Validation Efficiency

- Keep default sequential validation non-debug for daily checks.
- Use debug builds only when investigating failures (`FLUXAURA_BUILD_DEBUG=1`).
- Continue command/core validation in sequence to avoid Windows process contention.

Success metric:

- Faster validation cycle with fewer transient Windows process failures.

## Priority 5: Crash and Freeze Guardrails

- Add telemetry-safe local diagnostics for:
  - peak memory usage,
  - long tasks,
  - media decode errors.
- Add watchdogs around expensive model/transcode paths with timeout + user feedback.
- Add user-facing recovery actions: stop all media, clear previews, reload current page resources.

Success metric:

- Better recovery from heavy-load scenarios without full app restart.

## Suggested Next Implementation Sprint

1. Add "Performance Mode" toggle in editor preferences.
2. Add media resource cleanup hooks on page switches in Play/Present.
3. Add long-task warnings in dev diagnostics panel.
4. Add an automated stress test project and run it in CI-like local validation.
