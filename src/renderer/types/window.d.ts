import type { RendererBridge } from '@preload/bridge'

declare global {
  interface Window {
    vj?: RendererBridge
  }
}

export {}
