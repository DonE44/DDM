# FluxAura Studio Beta Testing Guide

Use this guide when testing FluxAura Studio beta builds.

## How To Start The App

Development build:

```powershell
node scripts/start-desktop-dev.cjs
```

Packaged beta:

```text
release\FluxAura Studio-Setup-0.1.0.exe
```

or:

```text
release\win-unpacked\FluxAura Studio.exe
```

## What To Test First

1. Create a new project.
2. Add text, image, audio, video, hotspot, and button elements.
3. Save the project.
4. Close FluxAura Studio.
5. Reopen FluxAura Studio.
6. Confirm the project restores correctly.
7. Export HTML, ZIP bundle, PNG, script, and MP4 where applicable.
8. Reopen exported files in a browser or media player.

## Bug Report Template

Please include:

- FluxAura Studio version.
- Windows version.
- Exact steps to reproduce.
- What you expected to happen.
- What actually happened.
- Screenshot or screen recording if useful.
- Whether the issue happens every time or only sometimes.
- Any media file type involved, such as MP4, MOV, WAV, PDF, or GIF.

## Diagnostic Logs

Main-process and renderer crash/error logs are written to:

```text
%TEMP%\fluxaura-studio-launch.log
```

To open it:

1. Press `Windows + R`.
2. Type:

```text
%TEMP%
```

3. Press Enter.
4. Open:

```text
fluxaura-studio-launch.log
```

For development startup logs, also check:

```text
release\desktop-dev-launcher.log
release\desktop-dev-vite.out.log
release\desktop-dev-vite.err.log
```

## Media Cache Checks

FluxAura Studio transcodes some legacy media into a local media cache.

To inspect it:

1. Open the right inspector.
2. Choose the diagnostics tab.
3. Review **Transcoded media cache**.
4. Use **Refresh cache** after importing/transcoding media.
5. Use **Clear cache** to remove generated transcode files.

Clearing this cache does not delete original project media.

## Known Beta Risks

- Some packaging commands can be retry-sensitive on Windows after crashes or locked files.
- Large MP4 exports can take a long time and use significant disk space.
- Chroma-key video currently uses Canvas 2D CPU processing, not WebGL.
- Some legacy project/script identifiers remain for compatibility while the FluxAura rebrand is completed.
- Manual command testing is still in progress; see `docs/command-test-results.md`.

## Tester Safety Notes

- Test with copies of important projects and media.
- Keep original media files backed up.
- Do not close the terminal running the development app unless you want to stop FluxAura Studio.
- If an export appears frozen, wait at least a few minutes for large media projects before force-closing.
