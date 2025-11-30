# GammaLoom VJ Tool

Electron + React + TypeScript application that delivers the two-window VJ workflow described in `vj-tool-spec.md`, inspired by the MuLoom UI patterns. It exposes a Control window (four decks, master preview, asset browser) and a Projection window that renders the mixed output in fullscreen-friendly canvas.

## Features

- **MixEngine @ Electron main**: centralizes `MixState`, validates deck updates, and broadcasts changes over IPC.
- **Assets manager**: scans `../mp4` (or paths configured via `VJ_ASSET_ROOT`) for videos/images and exposes them to the Control UI.
- **Dual renderers**: Control UI for operators, Projection UI for fullscreen playback, both sharing a typed IPC bridge.
- **Canvas compositing**: Master Preview and Projection reuse a shared `MixCanvas` to layer hidden `<video>` buffers onto `<canvas>` with per-deck opacity and speed.
- **Strict toolchain**: Vite + React 18, TypeScript `strict`, ESLint (flat config) + Prettier, ready for future GLSL/WebGL expansion.

## Requirements

- Node.js ≥ 18. **Electron 33** (ships with Node 20) is installed via devDependencies.
- macOS / Windows / Linux with GPU acceleration (Control window can run windowed; Projection window supports fullscreen via `PROJECTION_FULLSCREEN=1`).

## Getting Started

```bash
npm install        # install dependencies
npm run dev        # start Vite + Electron in watch mode
npm run lint       # ESLint (flat config)
npm run typecheck  # TypeScript type checking
npm run build      # build renderer + electron bundles and package via electron-builder
```

During `npm run dev` two BrowserWindows are opened:

- `#/control`: main operator UI (Control window).
- `#/projection`: projection surface. Use a second display and toggle fullscreen (green zoom button on macOS or `View → Enter Full Screen`).

## Assets

- Default search path: `../mp4` relative to the `vj-tool` directory (bundled repo already contains `mp4/footage`, `mp4/overlay`).
- Override via env: `VJ_ASSET_ROOT="/path/to/clips:/another/path" npm run dev` (use platform path delimiter).
- Supported extensions: `.mp4`, `.mov`, `.m4v`, `.webm` (video) and `.png`, `.jpg`, `.jpeg` (images). Images are currently loaded as still layers.

## Directory Layout

```
vj-tool/
  src/
    main/              # Electron main process (mixEngine, assetsManager, window factory)
    preload/           # Preload bridge that exposes the typed `window.vj` API
    renderer/
      control/         # Control window React tree (decks, browser, master preview)
      projection/      # Projection window React tree (canvas output)
      shared/          # Hooks + MixCanvas component
    shared/            # Types, IPC channel constants, defaults
  index.html           # Single entry; hash routing decides control/projection
  vite.config.ts       # Vite + electron plugin configuration
  eslint.config.js     # Flat ESLint config (React + TS)
  vj-tool-spec.md      # Project requirements (reference)
  MuLoom-2.backup/     # Reference project used for layout inspiration
```

## IPC Surface

Channel | Direction | Payload
------- | --------- | -------
`mix:state` | Main → Renderer | `MixState` pushed whenever MixEngine changes
`mix:getState` | Renderer → Main (invoke) | returns latest `MixState`
`deck:update` | Renderer → Main (invoke) | `{ deckId, patch }` partial deck update
`mix:setMasterOpacity` | Renderer → Main (invoke) | `number` between 0–1
`assets:list` | Renderer → Main (invoke) | returns discovered `Asset[]`

`window.vj` (declared via preload) wraps these IPC verbs with type-safe helpers for both renderers.

## Control Workflow

1. Pick the active deck (A–D). The column border lights up cyan.
2. Load footage from the Content Browser (assets pulled from `mp4`). Clicking a clip assigns it to the active deck.
3. Use the Opacity and Speed faders per deck; press **Play/Pause** or **Fade Out** to manage playback.
4. The Master Preview shows the composite feed at reduced resolution. Adjust the **Master Opacity** to fade the entire mix.
5. Projection window mirrors the MixEngine output at canvas scale; attach to projector/LED wall.

## Notes & Next Steps

- Canvas mixing currently uses Canvas2D for simplicity; `MixCanvas` is isolated so a future WebGL port (glslCanvas, custom shaders, etc.) can swap the drawing implementation.
- Audio analysis hooks (Web Audio API) can be added inside `useElectronRealtime` or via a new preload channel without touching the main renderer structure.
- Multi-scene presets / project save-load are not included per spec, but `MixEngine` already exposes a single state object ready for serialization.
