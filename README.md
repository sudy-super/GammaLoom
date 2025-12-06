# GammaLoom VJ Tool

## 技術スタック概要 (日本語)
- **アプリ形態**: Electron 33 デスクトップアプリ (2 ウィンドウ構成: Control / Projection)
- **フロントエンド**: Vite + React 18 + TypeScript、CSS は Tailwind 3 系 + カスタム CSS
- **ビルド/配布**: `vite-plugin-electron` でレンダラーを Vite ビルドし、`electron-builder` でパッケージング
- **レンダラー機能**: React でデッキ UI、メディア管理 (`useVideoMedia`)、GLSL ジェネレーター & レンダラー、WebRTC 配信用ユーティリティ
- **メインプロセス**: `MixEngine` (ミックス状態の単一ソース) と `AssetsManager` (動画/画像/GLSL のスキャン) を保持
- **IPC/ブリッジ**: preload (`window.vj`) が型付き IPC を公開し、レンダラーからミックス更新・アセット取得を呼び出す
- **メディア/シェーダ**: デフォルトで `assets/mp4` と `assets/glsl` を走査し、動画・画像・シェーダをデッキに割り当て可能。`glslCanvas` 依存を含む

## アーキテクチャ
```mermaid
flowchart LR
  subgraph Electron Main
    A[MixEngine\n状態管理/検証]
    B[AssetsManager\nアセット列挙]
  end
  subgraph Preload
    C[window.vj\nIPC ブリッジ]
  end
  subgraph Renderer
    subgraph Control Window (#/control)
      D[React UI\nデッキ4基 + ブラウザ]
      E[useRealtime\nIPCサブスク]
      F[useVideoMedia\nHTMLVideo管理]
    end
    subgraph Projection Window (#/)
      G[ViewerPage\nGLSLRenderer + Video合成]
      H[useRTCStreaming\nオプション配信]
    end
  end
  subgraph Assets
    I[assets/mp4, assets/glsl\n(環境変数で追加可)]
  end

  I -- listAssets --> B
  B -- Asset[] --> C
  D <-- onMixState / invoke --> A
  G <-- onMixState / invoke --> A
  D <-- listAssets --> C
  C <--> A
  D -- Deck操作/クロスフェーダー --> C
  G -- ビューア状態/RTC --> C
```

## 主要コンポーネントと責務
- `src/main/mixEngine.ts`: Deck 状態とクロスフェーダー・マスターオパシティをバリデートしつつ保持。変化時に `mix:state` をブロードキャスト
- `src/main/assetsManager.ts`: 動画/画像/GLSL を再帰スキャンし、`vjasset://` プロトコル URL を付与して返却
- `src/main/windows.ts`: Control/Projection の 2 BrowserWindow を生成。開発時は Vite Dev Server、配布時は `dist` をロード
- `src/preload/bridge.ts`: `window.vj` として IPC をエクスポート（状態取得・デッキ更新・アセット列挙・クロスフェーダー操作）
- `src/renderer/modules/useRealtime.ts`: preload 経由で MixState/Asset を購読し、Control/Viewer 両画面で共通のリアルタイムデータソースを提供
- `src/renderer/pages/control/ControlPage.tsx`: 4 デッキ UI、コンテンツブラウザ、マスター・クロスフェーダー UI、GLSL 生成のトリガーを担当
- `src/renderer/pages/ViewerPage.tsx`: GLSLRenderer とビデオ合成を行い Projection に表示。WebRTC (`useRTCStreaming`) での配信開始にも対応

---

Electron + React + TypeScript application that delivers the two-window VJ workflow described in `vj-tool-spec.md`, inspired by the MuLoom UI patterns. It exposes a Control window (four decks, master preview, asset browser) and a Projection window that renders the mixed output in fullscreen-friendly canvas.

## Features

- **MixEngine @ Electron main**: centralizes `MixState`, validates deck updates, and broadcasts changes over IPC.
- **Assets manager**: scans `assets/mp4` (video/image) and `assets/glsl` (shader snippets) by default, or any folders provided via `VJ_ASSET_ROOT` / `VJ_SHADER_ROOT`, and exposes them to the Control UI.
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

- Default search paths: `assets/mp4` (footage/overlay) and `assets/glsl` relative to the repo root.
- Override via env: `VJ_ASSET_ROOT="/path/to/clips" VJ_SHADER_ROOT="/path/to/glsl" npm run dev` (use platform path delimiter for multiples).
- Supported extensions: `.mp4`, `.mov`, `.m4v`, `.webm` (video), `.png`, `.jpg`, `.jpeg` (images), and `.glsl/.frag/.fs` for shaders.

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
2. Load footage from the Content Browser (assets pulled from `assets/mp4`). Clicking a clip assigns it to the active deck.
3. Use the Opacity and Speed faders per deck; press **Play/Pause** or **Fade Out** to manage playback.
4. The Master Preview shows the composite feed at reduced resolution. Adjust the **Master Opacity** to fade the entire mix.
5. Projection window mirrors the MixEngine output at canvas scale; attach to projector/LED wall.

## Notes & Next Steps

- Canvas mixing currently uses Canvas2D for simplicity; `MixCanvas` is isolated so a future WebGL port (glslCanvas, custom shaders, etc.) can swap the drawing implementation.
- Audio analysis hooks (Web Audio API) can be added inside `useElectronRealtime` or via a new preload channel without touching the main renderer structure.
- Multi-scene presets / project save-load are not included per spec, but `MixEngine` already exposes a single state object ready for serialization.
