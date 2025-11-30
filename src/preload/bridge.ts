import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { Asset, DeckId, DeckState, MixState } from '@shared/types'

export type RendererBridge = {
  onMixState: (_callback: (_state: MixState) => void) => () => void
  getMixState: () => Promise<MixState>
  updateDeck: (_deckId: DeckId, _patch: Partial<DeckState>) => Promise<MixState>
  setMasterOpacity: (_value: number) => Promise<MixState>
  listAssets: () => Promise<Asset[]>
}

export const exposeRendererBridge = () => {
  const bridge: RendererBridge = {
    onMixState: (callback) => {
      const handler = (_event: IpcRendererEvent, state: MixState) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.MIX_STATE, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MIX_STATE, handler)
    },
    getMixState: () => ipcRenderer.invoke(IPC_CHANNELS.MIX_GET_STATE),
    updateDeck: (deckId, patch) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_UPDATE, { deckId, patch }),
    setMasterOpacity: (value) => ipcRenderer.invoke(IPC_CHANNELS.MASTER_OPACITY, value),
    listAssets: () => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_LIST),
  }

  contextBridge.exposeInMainWorld('vj', bridge)
}
