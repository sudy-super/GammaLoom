import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { MixEngine } from './mixEngine'
import { AssetsManager } from './assetsManager'
import { createControlWindow, createProjectionWindow } from './windows'
import { IPC_CHANNELS } from '@shared/ipc'
import type { CrossfaderPayload, DeckUpdatePayload } from '@shared/ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const PRELOAD_BUNDLE = path.join(__dirname, '../preload/index.mjs')
const assetsManager = new AssetsManager(resolveAssetRoots())
const mixEngine = new MixEngine()

let controlWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  registerAssetProtocol()
  createWindows()
  registerIpcHandlers()
})

app.on('second-instance', () => {
  if (controlWindow) {
    if (controlWindow.isMinimized()) controlWindow.restore()
    controlWindow.focus()
  }
})

app.on('window-all-closed', () => {
  controlWindow = null
  projectionWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindows()
  }
})

mixEngine.on('stateChanged', (state) => {
  broadcastState(state)
})

const registerIpcHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.MIX_GET_STATE, () => mixEngine.getState())

  ipcMain.handle(
    IPC_CHANNELS.DECK_UPDATE,
    (_event, payload: DeckUpdatePayload) => mixEngine.updateDeck(payload.deckId, payload.patch),
  )

  ipcMain.handle(IPC_CHANNELS.MASTER_OPACITY, (_event, value: number) =>
    mixEngine.setMasterOpacity(value),
  )

  ipcMain.handle(IPC_CHANNELS.CROSS_FADER, (_event, payload: CrossfaderPayload) =>
    mixEngine.setCrossfader(payload.target, payload.value),
  )

  ipcMain.handle(IPC_CHANNELS.ASSETS_LIST, () => assetsManager.listAssets())
}

const createWindows = () => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: workWidth, height: workHeight } = primaryDisplay.workAreaSize
  const controlWidth = Math.min(workWidth, 1920)
  const controlHeight = Math.min(workHeight, 1100)

  controlWindow = createControlWindow({
    title: 'GammaLoom VJ Control',
    preloadPath: PRELOAD_BUNDLE,
    rendererDist: RENDERER_DIST,
    devServerUrl: VITE_DEV_SERVER_URL,
    width: controlWidth,
    height: controlHeight,
  })

  projectionWindow = createProjectionWindow({
    title: 'GammaLoom Projection',
    preloadPath: PRELOAD_BUNDLE,
    rendererDist: RENDERER_DIST,
    devServerUrl: VITE_DEV_SERVER_URL,
    fullscreen: process.env.PROJECTION_FULLSCREEN === '1',
    backgroundColor: '#000000',
  })

  if (VITE_DEV_SERVER_URL) {
    controlWindow?.webContents.openDevTools({ mode: 'detach' })
  }

  broadcastState(mixEngine.getState())
}

const broadcastState = (state = mixEngine.getState()) => {
  const windows: BrowserWindow[] = [controlWindow, projectionWindow].filter(
    (win): win is BrowserWindow => Boolean(win),
  )
  windows.forEach((win) => win.webContents.send(IPC_CHANNELS.MIX_STATE, state))
}

function resolveAssetRoots(): string[] {
  const roots = new Set<string>()

  const register = (candidate: string | undefined) => {
    if (!candidate) return
    const resolved = path.resolve(candidate)
    roots.add(resolved)
  }

  const addFromEnv = (value?: string) => {
    if (!value) return
    value
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => register(item))
  }

  addFromEnv(process.env.VJ_ASSET_ROOT)
  addFromEnv(process.env.VJ_SHADER_ROOT)

  if (roots.size === 0) {
    register(path.join(process.cwd(), 'assets/mp4'))
    register(path.join(process.cwd(), 'assets/glsl'))
  }

  return Array.from(roots)
}

function registerAssetProtocol() {
  protocol.registerFileProtocol('vjasset', (request, callback) => {
    try {
      const normalized = request.url.replace('vjasset://', 'file://')
      const parsed = new URL(normalized)
      const decoded = decodeURIComponent(parsed.pathname)
      callback({ path: decoded })
    } catch (error) {
      console.error('[vjasset] Failed to resolve path', request.url, error)
      callback({ path: '' })
    }
  })
}
