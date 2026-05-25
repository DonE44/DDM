# Publish Runtime Toggle Controls

This document defines the end-user control labels that work in exported FluxAura HTML players.

## Goal

Use simple button labels for novice users while preserving advanced action-chain flexibility for power users.

## Supported Event Labels

Add a Button element, set action type to event, then set the event label to one of:

- `lyrics-btn`
  - Toggles lyric word highlighting ON/OFF.
  - Aliases: `karaoke-btn`, `highlight-btn`.

- `narration-btn`
  - Toggles page narration play/pause for narration tracks and page audio clips.
  - Alias: `narration-toggle-btn`.

- `narration-mute-btn`
  - Toggles narration mute/unmute without changing playback state.
  - Alias: `narration-mute-toggle`.

## Runtime UX Behavior

When the player runs, matching toggle buttons now show:

- Text state suffixes:
  - Narration: `(Play)` / `(Pause)`
  - Narration mute: `(Sound On)` / `(Muted)`
  - Lyrics: `(On)` / `(Off)`

- Visual state cues:
  - Border and glow style update when state changes.
  - `aria-pressed` is updated for accessibility-aware readers.

Only buttons with these event labels are affected. Other buttons are unchanged.

## Authoring Tips

- Keep labels visible and short, such as `Lyrics`, `Narration`, and `Mute`.
- Place toggle buttons in a consistent position across pages to reduce user confusion.
- For advanced logic, these labels can still be used inside action chains.
