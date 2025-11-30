import { BrowserWindow, shell } from 'electron'
import path from 'node:path'

type WindowParams = {
  title: string
  hash: string
  preloadPath: string
  rendererDist: string
  devServerUrl?: string
  width?: number
  height?: number
  backgroundColor?: `#${string}`
  fullscreen?: boolean
}

export type WindowHandles = {
  control: BrowserWindow | null
  projection: BrowserWindow | null
}

export const createControlWindow = (params: Omit<WindowParams, 'hash'> & { hash?: string }) =>
  createWindow({
    width: params.width ?? 1380,
    height: params.height ?? 840,
    ...params,
    hash: params.hash ?? 'control',
  })

export const createProjectionWindow = (params: Omit<WindowParams, 'hash'> & { hash?: string }) =>
  createWindow({
    width: params.width ?? 1280,
    height: params.height ?? 720,
    fullscreen: params.fullscreen ?? false,
    ...params,
    hash: params.hash ?? 'projection',
  })

const createWindow = ({
  title,
  hash,
  preloadPath,
  rendererDist,
  devServerUrl,
  width,
  height,
  backgroundColor = '#000000',
  fullscreen,
}: WindowParams) => {
  const browserWindow = new BrowserWindow({
    title,
    width,
    height,
    backgroundColor,
    fullscreen,
    webPreferences: {
      preload: preloadPath,
    },
  })

  if (devServerUrl) {
    browserWindow.loadURL(`${devServerUrl}#/${hash}`)
  } else {
    browserWindow.loadFile(path.join(rendererDist, 'index.html'), { hash: `/${hash}` })
  }

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  return browserWindow
}
