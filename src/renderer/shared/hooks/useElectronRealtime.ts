import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Asset, DeckId, DeckState, MixState, RendererRole } from '@shared/types'

export type UseElectronRealtimeResult = {
  mixState: MixState | null
  assets: Asset[]
  loading: boolean
  updateDeck: (_deckId: DeckId, _patch: Partial<DeckState>) => void
  setMasterOpacity: (_value: number) => void
  refreshAssets: () => Promise<void>
}

export const useElectronRealtime = (
  role: RendererRole = 'controller',
): UseElectronRealtimeResult => {
  const [mixState, setMixState] = useState<MixState | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false

    const bootstrap = async () => {
      if (!window.vj) {
        setLoading(false)
        return
      }

      try {
        const state = await window.vj.getMixState()
        if (!cancelled) {
          setMixState(state)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }

      unsub = window.vj.onMixState((state) => setMixState(state))
    }

    bootstrap()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const loadAssets = useCallback(async () => {
    if (role !== 'controller' || !window.vj?.listAssets) {
      return
    }
    try {
      const list = await window.vj.listAssets()
      setAssets(list)
    } catch (error) {
      console.error('Failed to load assets', error)
    }
  }, [role])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const updateDeck = useCallback((deckId: DeckId, patch: Partial<DeckState>) => {
    window.vj?.updateDeck(deckId, patch)
  }, [])

  const setMasterOpacity = useCallback((value: number) => {
    window.vj?.setMasterOpacity(value)
  }, [])

  return useMemo(
    () => ({
      mixState,
      assets,
      loading,
      updateDeck,
      setMasterOpacity,
      refreshAssets: loadAssets,
    }),
    [assets, loadAssets, loading, mixState, setMasterOpacity, updateDeck],
  )
}
