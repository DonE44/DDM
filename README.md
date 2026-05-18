<<<<<<< HEAD
# DDM
=======
# FluxAura Studio

Modernized multimedia authoring studio with React for the editor UI and Electron for the desktop runtime.

## Project Structure

- `src/` - React editor and playback UI
- `electron/` - Electron main process, preload bridge, and desktop-only IPC
- `scripts/` - reliability-first build and validation scripts
- `release/` - generated desktop artifacts and validation reports

## Start Commands

- `npm start`
  Launches the FluxAura Studio desktop program in development mode.

- `npm run start:web`
  Launches the web-only Vite development server.

- `npm run desktop:dev`
  Starts Vite on port `5173` and launches Electron against it.

## Build Commands

- `npm run build`
  Builds the web app into `dist/`.

- `npm run desktop:pack`
  Produces an unpacked Electron app in `release/win-unpacked/`.

- `npm run desktop:build`
  Produces the Windows installer in `release/`.

## Validation

- `npm run lint`
  Runs ESLint.

- `npm run core:validate`
  Runs the reliability-first validation gate for lint, build, pack, and launch/stop checks.

## Notes

- If you want the actual FluxAura Studio program window, use `npm start` rather than the old Vite-only workflow.
- The web editor is still available separately via `npm run start:web`.
>>>>>>> 0bb215e (Initial project import)
