# Command Test Checklist

Use this checklist for item-by-item testing after each upgrade/fix.

## How To Use

1. Start app with `npm start`.
2. Execute each command in Edit mode unless noted.
3. Mark `PASS` or `FAIL`.
4. If failed, add a short note with repro steps.

---

## File Commands (10)

- [ ] `file-new` — New script resets pages, selection, filename, mode, and stage; when already new shows explicit no-op status.
- [ ] `file-open` — Opens `.mme`/`.sca`; canceling shows explicit status.
- [ ] `file-save` — Saves current project; canceling shows explicit status.
- [ ] `file-export-html` — Exports playable HTML; if no pages exist shows explicit status.
- [ ] `file-export-storybook` — Opens storybook password dialog.
- [ ] `file-export-screen-png` — Exports current screen as PNG.
- [ ] `file-export-page-png` — Exports current page canvas as PNG.
- [ ] `file-export-script` — Exports `.sca` script file.
- [ ] `file-import-pages` — File picker for `.mme`/`.sca`; merges pages; no pages found shows status.
- [ ] `file-import-pdf` — File picker for PDF; imports pages as storybook.
- [ ] `file-print` — Opens print dialog.

## Page Commands (7)

- [ ] `page-new` — Inserts page after current.
- [ ] `page-duplicate` — Clones current page and elements.
- [ ] `page-delete` — Deletes current page; last page cannot be deleted; lands on valid index.
- [ ] `page-prev` — Moves to previous page; at first page shows boundary status.
- [ ] `page-next` — Moves to next page; at last page shows boundary status.
- [ ] `page-move-up` — Moves current page earlier in the order.
- [ ] `page-move-down` — Moves current page later in the order.

## Edit Commands (5)

- [ ] `edit-undo` — Undoes last edit; at empty history shows explicit status.
- [ ] `edit-redo` — Redoes last undone edit; at empty redo stack shows explicit status.
- [ ] `edit-copy` — Copies selected element(s) to internal clipboard.
- [ ] `edit-paste` — Pastes clipboard elements onto current page; empty clipboard shows status.
- [ ] `edit-duplicate` — Duplicates selected element(s) with offset.
- [ ] `edit-button` — Opens button editor for selected button; non-button selection shows status.

## Selection Commands (3)

- [ ] `selection-delete` — Deletes selected element(s); no selection deletes page.
- [ ] `selection-duplicate` — Duplicates selected element with offset.
- [ ] `select-all` — Selects all elements on current page; reports count.
- [ ] `select-none` — Clears selection.

## Layer Commands (4)

- [ ] `layer-front` — Moves selected element to top z-order.
- [ ] `layer-up` — Moves selected element up one z-order step.
- [ ] `layer-down` — Moves selected element down one z-order step.
- [ ] `layer-back` — Moves selected element to bottom z-order.

## Align / Space Commands (8)

- [ ] `align-left` — Aligns selected element to left edge of stage.
- [ ] `align-hcenter` — Aligns selected element horizontally centre.
- [ ] `align-right` — Aligns selected element to right edge of stage.
- [ ] `align-top` — Aligns selected element to top edge of stage.
- [ ] `align-vcenter` — Aligns selected element vertically centre.
- [ ] `align-bottom` — Aligns selected element to bottom edge of stage.
- [ ] `space-h` — Spaces selected elements evenly horizontally.
- [ ] `space-v` — Spaces selected elements evenly vertically.

## Nudge Commands (pattern: `nudge-{dir}-{px}`)

- [ ] `nudge-left-1` — Nudges selected element 1 px left (arrow key).
- [ ] `nudge-right-1` — Nudges selected element 1 px right.
- [ ] `nudge-up-1` — Nudges selected element 1 px up.
- [ ] `nudge-down-1` — Nudges selected element 1 px down.
- [ ] `nudge-left-10` — Nudges 10 px left (Shift+Arrow).
- [ ] `nudge-right-10` / `nudge-up-10` / `nudge-down-10` — same for other directions.

## Group Commands (2)

- [ ] `group-selected` — Groups selected elements.
- [ ] `ungroup-selected` — Ungroups selected group.

## View Commands (12)

- [ ] `view-spread` — Toggles spread/two-page view.
- [ ] `view-script` — Toggles script flow panel; reports opened/closed.
- [ ] `view-script-close` — Closes script flow panel.
- [ ] `view-variables` — Toggles variable editor panel.
- [ ] `view-close-overlays` — Stops audio/playback and closes all overlay panels; nothing open shows explicit status.
- [ ] `view-shortcuts` — Toggles keyboard shortcuts overlay.
- [ ] `view-panel-left` — Toggles left panel visibility.
- [ ] `view-panel-right` — Toggles right panel visibility.
- [ ] `view-panel-bottom` — Toggles bottom panel visibility.
- [ ] `view-media-lib` — Toggles media library panel.
- [ ] `view-grid-toggle` — Toggles stage grid; reports on/off.
- [ ] `view-zoom-in` — Zooms in (0.1 step); at max (300%) shows boundary status.
- [ ] `view-zoom-out` — Zooms out (0.1 step); at min (10%) shows boundary status.
- [ ] `view-zoom-fit` — Fits stage to window.
- [ ] `view-bg-image` — Opens media picker for background image.

## Playback Commands (7)

- [ ] `play-start` — Starts playback from current page; if already playing shows explicit status.
- [ ] `play-stop` — Stops playback; if not playing shows explicit status.
- [ ] `play-prev` — Previous play page; at page 0 shows boundary status; not playing shows status.
- [ ] `play-next` — Next play page; at last page shows boundary status; not playing shows status.
- [ ] `play-loop-toggle` — Toggles presentation loop; reports ON/OFF.
- [ ] `play-ctrl-toggle` — Toggles player controls visibility; reports visible/hidden.
- [ ] `play-interactive` — Toggles interactive mode; reports ON/OFF.
- [ ] `play-fullscreen-toggle` — Toggles fullscreen launch; reports ON/OFF.
- [ ] `play-dev-mode` — Toggles dev mode; reports ON/OFF.

## Tool Commands (7)

- [ ] `tool-select` — Activates select tool; if already active shows explicit status.
- [ ] `tool-text` — Activates text insert tool; if already active shows explicit status.
- [ ] `tool-image` — Activates image insert tool; if already active shows explicit status.
- [ ] `tool-button` — Opens new button editor.
- [ ] `tool-wipe` — Switches inspector to Wipe/Transition tab.
- [ ] `tool-mpeg` — Activates MPEG video tool; if already active shows explicit status.
- [ ] `tool-hotspot` — Activates hotspot draw tool; resets freehand state.
- [ ] `tool-menubar` — Activates menu bar insert tool.

---

## Result Summary

- Date:
- Build/Commit:
- Total commands: 83
- Pass count:
- Fail count:
- Notes:
