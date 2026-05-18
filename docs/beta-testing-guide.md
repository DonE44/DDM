# FluxAura Studio Beta Testing Guide

Use this guide when testing FluxAura Studio beta builds.

## How To Start The App

Development build:

```powershell
node scripts/start-desktop-dev.cjs
```

Stable validation:

```powershell
node scripts/stable-validation.mjs
```

See `docs/windows-command-stability.md` if PowerShell or npm wrapper commands crash on Windows.

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

## Long Operation Feedback

For longer operations, FluxAura Studio should show activity in the footer status bar. Some blocking operations, such as storybook export, also show a centered progress overlay.

Check this when testing:

1. Import a multi-page PDF.
2. Export an interactive storybook ZIP.
3. Import or convert a legacy media file.
4. Save a larger project.
5. Export the media diagnostics report.

If the app is working but no footer activity or progress message appears, report the operation and file type involved.

## Settings Checks

Open **Settings** from the top toolbar and verify:

1. Auto-save interval persists after closing and reopening FluxAura Studio.
2. Default export folder persists and is reused by HTML, MMP, and ZIP publish exports.
3. Clearing the default export folder returns publish exports to the Save dialog flow.
4. Turning off startup project restore starts FluxAura Studio without reopening the previous project.
5. Turning off blocking progress overlays still leaves footer progress/status visible.

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

## Whisper Model Checks

Local Whisper transcription downloads the selected AI model the first time it is used.

To inspect it:

1. Open the Whisper speech-to-text panel.
2. Choose a local model such as Tiny, Base, Small, or Medium.
3. Review the **Cache** line under the model selector.
4. Use **Refresh cache** after a first transcription or model download.
5. Use **Clear selected model** only when testing model re-downloads or freeing disk space.

Clearing a Whisper model cache does not delete audio files, transcripts, or projects. The OpenAI API option does not use a local model cache.

## Known Beta Risks

- Some packaging commands can be retry-sensitive on Windows after crashes or locked files.
- Large MP4 exports can take a long time and use significant disk space.
- Chroma-key video currently uses Canvas 2D CPU processing, not WebGL.
- First local Whisper transcription can be slow because the chosen model may need to download.
- Some legacy project/script identifiers remain for compatibility while the FluxAura rebrand is completed.
- Manual command testing is still in progress; see `docs/command-test-results.md`.

## Tester Safety Notes

- Test with copies of important projects and media.
- Keep original media files backed up.
- Do not close the terminal running the development app unless you want to stop FluxAura Studio.
- If an export appears frozen, wait at least a few minutes for large media projects before force-closing.
