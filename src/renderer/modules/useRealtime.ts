import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ControlSettings,
  DeckMediaStateIntent,
  DeckTimelineState,
  DeckTimelineStateMap,
  FallbackAssets,
  FallbackLayer,
  MixDeck,
  MixState,
  OutboundMessage,
  RTCSignalMessage,
  StartVisualizationPayload,
  TransportSnapshot,
  ViewerStatus,
} from '../types/realtime'
import { createDefaultDeckTimelineState, createDefaultTransportSnapshot } from '../types/realtime'
import { MIX_DECK_KEYS, type DeckKey } from '../utils/mix'
import type { Asset, DeckId, DeckState as ElectronDeckState, MixState as ElectronMixState } from '@shared/types'

type ConnectionState = 'connecting' | 'open' | 'closed'

type RequestDeckOptions = {
  resume?: boolean
  reload?: boolean
}

const EMPTY_DECK: MixDeck = { type: null, assetId: null, opacity: 0, enabled: false }
const DEFAULT_ASSETS: FallbackAssets = { glsl: [], videos: [], overlays: [] }
const DECK_KEY_TO_ID: Record<DeckKey, DeckId> = { a: 0, b: 1, c: 2, d: 3 }

export interface RealtimeHandlers {
  onStartVisualization?: (payload: StartVisualizationPayload) => void
  onStopVisualization?: () => void
  onRegenerateShader?: () => void
  onSetAudioSensitivity?: (value: number) => void
  onCodeProgress?: (payload: { code: string; isComplete: boolean }) => void
  onRTCSignal?: (signal: RTCSignalMessage) => void
}

export function useRealtime(_role: 'viewer' | 'controller', _handlers: RealtimeHandlers = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [mixState, setMixState] = useState<MixState>(() => createPlaceholderMixState())
  const [assets, setAssets] = useState<FallbackAssets>(DEFAULT_ASSETS)
  const [deckMediaStates, setDeckMediaStates] = useState<DeckTimelineStateMap>(() => createDefaultDeckMediaStates())
  const [viewerStatus] = useState<ViewerStatus>({ isRunning: false, isGenerating: false, error: '' })
  const [controlSettings] = useState<ControlSettings>({ modelProvider: 'gemini', audioInputMode: 'file', prompt: '' })
  const [fallbackLayers] = useState<FallbackLayer[]>([])
  const [transport] = useState<TransportSnapshot>(() => createDefaultTransportSnapshot())
  const [transportTick] = useState({ mono_us: 0, receivedAt: 0 })

  const latestMixRef = useRef<MixState>(mixState)
  const assetsLoadedRef = useRef(false)
  const assetIndexRef = useRef<Record<string, Asset>>({})

  const resolveAssetUrl = useCallback(
    (assetId: string | null, fallback?: string | null) => {
      if (fallback) {
        return fallback
      }
      if (!assetId) {
        return null
      }
      return assetIndexRef.current[assetId]?.url ?? null
    },
    [],
  )

  const updateFromElectronMix = useCallback((state: ElectronMixState) => {
    const converted = convertMixState(state)
    latestMixRef.current = converted
    setMixState(converted)
    setDeckMediaStates((previous) => {
      const nowSeconds = Date.now() / 1000
      const next: DeckTimelineStateMap = { ...previous }
      let changed = false
      MIX_DECK_KEYS.forEach((key) => {
        const sourceUrl = resolveAssetUrl(converted.decks[key].assetId, converted.decks[key].sourceUrl ?? null)
        const deckIndex = DECK_KEY_TO_ID[key]
        const rawDeck = state.decks?.[deckIndex]
        const targetPlaying =
          typeof rawDeck?.playing === 'boolean' ? rawDeck.playing : Boolean(rawDeck?.enabled)
        const existing = previous[key]
        const current = existing ?? createDefaultDeckTimelineState()
        const basePosition = Number.isFinite(current.basePosition) ? current.basePosition : Number.NaN
        const position = Number.isFinite(current.position) ? current.position : Number.NaN
        const shouldResetClock = current.isPlaying !== targetPlaying || !Number.isFinite(current.updatedAt) || current.updatedAt <= 0
        const updatedAt = shouldResetClock ? nowSeconds : current.updatedAt
        const playRate =
          typeof rawDeck?.speed === 'number' && Number.isFinite(rawDeck.speed) && rawDeck.speed > 0
            ? rawDeck.speed
            : current.playRate
        const nextState = {
          ...current,
          src: sourceUrl,
          isPlaying: targetPlaying,
          error: false,
          isLoading: false,
          playRate: playRate ?? 1,
          basePosition,
          position,
          updatedAt,
        }

        const didChange =
          current.src !== nextState.src ||
          current.isPlaying !== nextState.isPlaying ||
          current.error !== nextState.error ||
          current.isLoading !== nextState.isLoading ||
          current.playRate !== nextState.playRate ||
          current.basePosition !== nextState.basePosition ||
          current.position !== nextState.position ||
          current.updatedAt !== nextState.updatedAt

        if (!existing || didChange) {
          changed = true
          next[key] = nextState
        }
      })
      return changed ? next : previous
    })
  }, [resolveAssetUrl])

  useEffect(() => {
    if (!window.vj) {
      return
    }

    setConnectionState('open')

    window.vj.getMixState().then(updateFromElectronMix).catch(() => undefined)
    window.vj.listAssets?.().then((list) => {
      assetsLoadedRef.current = true
      const map: Record<string, Asset> = {}
      list.forEach((asset) => {
        map[asset.id] = asset
      })
      assetIndexRef.current = map
      setAssets(convertAssets(list))
    })

    const unsubscribe = window.vj.onMixState?.((state) => updateFromElectronMix(state as ElectronMixState))
    return () => {
      unsubscribe?.()
    }
  }, [updateFromElectronMix])

  const updateDeck = useCallback((deckKey: DeckKey, patch: Partial<ElectronDeckState>) => {
    if (!window.vj) return
    const deckId = DECK_KEY_TO_ID[deckKey]
    window.vj.updateDeck(deckId, patch)
  }, [])

  const requestDeckToggle = useCallback(
    (deckKey: DeckKey, nextPlaying?: boolean) => {
      const deck = latestMixRef.current.decks[deckKey]
      const currentPlaying = typeof deck.playing === 'boolean' ? deck.playing : Boolean(deck.enabled)
      const shouldPlay = typeof nextPlaying === 'boolean' ? nextPlaying : !currentPlaying
      updateDeck(deckKey, { playing: shouldPlay })
    },
    [updateDeck],
  )

  const requestDeckSeek = useCallback((_: DeckKey, __: number, ___?: RequestDeckOptions) => {
    // Not implemented in Electron preview
  }, [])

  const requestDeckRate = useCallback(
    (deckKey: DeckKey, value: number) => {
      updateDeck(deckKey, { speed: value })
    },
    [updateDeck],
  )

  const requestDeckSource = useCallback(
    (deckKey: DeckKey, src: string | null, _options?: RequestDeckOptions) => {
      updateDeck(deckKey, { src, playing: Boolean(src) })
    },
    [updateDeck],
  )

  const requestDeckPlay = useCallback(
    (deckKey: DeckKey) => {
      updateDeck(deckKey, { playing: true })
    },
    [updateDeck],
  )

  const requestDeckState = useCallback(
    (deckKey: DeckKey, intent: DeckMediaStateIntent) => {
      const payload: Partial<DeckTimelineState> | undefined =
        intent && 'intent' in intent && intent.intent === 'state'
          ? intent.value ?? undefined
          : 'intent' in intent
            ? undefined
            : (intent as Partial<DeckTimelineState>);

      if (!payload) {
        return;
      }

      setDeckMediaStates((previous) => {
        const current = previous[deckKey] ?? createDefaultDeckTimelineState();
        const next = { ...current, ...payload };

        const changed =
          current.src !== next.src ||
          current.isPlaying !== next.isPlaying ||
          current.playRate !== next.playRate ||
          current.basePosition !== next.basePosition ||
          current.position !== next.position ||
          current.updatedAt !== next.updatedAt ||
          current.duration !== next.duration ||
          current.error !== next.error ||
          current.isLoading !== next.isLoading ||
          current.version !== next.version ||
          current.commandId !== next.commandId;

        if (!changed) {
          return previous;
        }

        return {
          ...previous,
          [deckKey]: next,
        }
      })
    },
    [],
  )

  const send = useCallback(
    (message: OutboundMessage) => {
      if (!window.vj) {
        return
      }
      if (message.type === 'update-mix-deck') {
        const { deck, data } = message.payload
        const patch: Partial<ElectronDeckState> = {}
        if (data.opacity !== undefined) patch.opacity = data.opacity
        if (data.enabled !== undefined) patch.enabled = data.enabled

        if (data.type === 'generative') {
          patch.assetType = 'generative'
          patch.assetId = null
          patch.src = null
        }

        if (data.assetId) {
          patch.assetId = data.assetId
          const asset = assetIndexRef.current[data.assetId]
          if (asset?.url) {
            patch.src = asset.url
          }
          if (asset?.kind === 'shader') {
            patch.assetType = 'shader'
          } else if (asset) {
            patch.assetType = 'video'
          }
        } else if (data.assetId === null) {
          patch.assetId = null
        }

        if (data.type === 'shader') {
          patch.assetType = 'shader'
        } else if (data.type === 'video') {
          patch.assetType = 'video'
        }

        updateDeck(deck as DeckKey, patch)
      } else if (message.type === 'update-crossfader') {
        window.vj.setCrossfader(message.payload.target, message.payload.value)
      }
    },
    [updateDeck],
  )

  return useMemo(
    () => ({
      connectionState,
      viewerStatus,
      controlSettings,
      assets: assetsLoadedRef.current ? assets : DEFAULT_ASSETS,
      mixState,
      deckMediaStates,
      fallbackLayers,
      transport,
      transportTick,
      send,
      requestDeckToggle,
      requestDeckSeek,
      requestDeckRate,
      requestDeckPlay,
      requestDeckSource,
      requestDeckState,
    }),
    [
      connectionState,
      viewerStatus,
      controlSettings,
      assets,
      mixState,
      deckMediaStates,
      fallbackLayers,
      transport,
      transportTick,
      send,
      requestDeckToggle,
      requestDeckSeek,
      requestDeckRate,
      requestDeckPlay,
      requestDeckSource,
      requestDeckState,
    ],
  )
}

const createDefaultDeckMediaStates = (): DeckTimelineStateMap => {
  const map = {} as DeckTimelineStateMap
  MIX_DECK_KEYS.forEach((key) => {
    map[key] = createDefaultDeckTimelineState()
  })
  return map
}

const createPlaceholderMixState = (): MixState => ({
  crossfaderAB: 0.5,
  crossfaderAC: 0.5,
  crossfaderBD: 0.5,
  crossfaderCD: 0.5,
  decks: {
    a: { ...EMPTY_DECK },
    b: { ...EMPTY_DECK },
    c: { ...EMPTY_DECK },
    d: { ...EMPTY_DECK },
  },
})

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

    const convertMixState = (state: ElectronMixState): MixState => {
      const decks = state.decks ?? []
      const mapDeck = (deck?: ElectronDeckState): MixDeck => {
        const assetId = deck?.assetId ?? null
        const sourceUrl = deck?.src ?? null
        const baseType = deck?.assetType ?? (assetId ? 'video' : null)
        return {
          type: baseType,
          assetId: assetId ?? sourceUrl,
          opacity: deck?.opacity ?? 0,
          enabled: Boolean(deck?.enabled ?? deck?.playing ?? deck?.opacity),
          playing: Boolean(deck?.playing),
          sourceUrl,
          speed: deck?.speed ?? 1,
        }
      }
  return {
    crossfaderAB: clamp(Number(state.crossfaderAB ?? state.masterOpacity ?? 0.5), 0, 1),
    crossfaderAC: clamp(Number(state.crossfaderAC ?? state.masterOpacity ?? 0.5), 0, 1),
    crossfaderBD: clamp(Number(state.crossfaderBD ?? state.masterOpacity ?? 0.5), 0, 1),
    crossfaderCD: clamp(Number(state.crossfaderCD ?? state.masterOpacity ?? 0.5), 0, 1),
    decks: {
      a: mapDeck(decks[0]),
      b: mapDeck(decks[1]),
      c: mapDeck(decks[2]),
      d: mapDeck(decks[3]),
    },
  }
}

const convertAssets = (items: Asset[]): FallbackAssets => {
  const videos = items
    .filter((asset) => asset.kind === 'video')
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: asset.folder ?? 'clips',
      folder: asset.folder,
      url: asset.url,
    }))
  const overlays = items
    .filter((asset) => asset.kind === 'image')
    .map((asset) => ({ id: asset.id, name: asset.name, url: asset.url, folder: asset.folder }))
  const glsl = items
    .filter((asset) => asset.kind === 'shader')
    .map((asset) => ({ id: asset.id, name: asset.name, code: asset.code ?? '' }))
  return {
    glsl,
    videos,
    overlays,
  }
}
