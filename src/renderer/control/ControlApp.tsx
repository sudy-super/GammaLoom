import { useCallback, useMemo, useState } from 'react'
import type { Asset, DeckId, DeckState } from '@shared/types'
import { useElectronRealtime } from '@renderer/shared/hooks/useElectronRealtime'
import { DeckColumn } from './components/DeckColumn'
import { MasterPreview } from './components/MasterPreview'
import { ContentBrowser } from './components/ContentBrowser'

export const ControlApp = () => {
  const { mixState, assets, loading, updateDeck, setMasterOpacity, refreshAssets } =
    useElectronRealtime('controller')
  const [activeDeck, setActiveDeck] = useState<DeckId>(0)

  const handleAssign = useCallback(
    (asset: Asset) => {
      if (!mixState) return
      const deck = mixState.decks.find((candidate) => candidate.id === activeDeck)
      if (!deck) return
      updateDeck(activeDeck, {
        src: asset.url,
        playing: true,
        opacity: deck.opacity > 0 ? deck.opacity : 1,
      })
    },
    [activeDeck, mixState, updateDeck],
  )

  const masterOpacity = mixState?.masterOpacity ?? 1

  const deckNodes = useMemo(() => {
    if (!mixState) return null
    return mixState.decks.map((deck) => (
      <DeckColumn
        key={deck.id}
        deck={deck}
        isActive={deck.id === activeDeck}
        onSelect={() => setActiveDeck(deck.id)}
        onUpdate={(patch: Partial<DeckState>) => updateDeck(deck.id, patch)}
      />
    ))
  }, [activeDeck, mixState, updateDeck])

  return (
    <div className="control-app">
      <header className="control-header">
        <div>
          <p className="eyebrow">GammaLoom</p>
          <h1>VJ Control</h1>
        </div>
        <div className="master-fader">
          <label htmlFor="master-opacity">Master Opacity</label>
          <input
            id="master-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterOpacity}
            onChange={(event) => setMasterOpacity(Number(event.target.value))}
          />
          <span>{masterOpacity.toFixed(2)}</span>
        </div>
      </header>

      <main className="control-body">
        <section className="deck-grid" aria-label="Deck controls">
          {loading && (!mixState || mixState.decks.length === 0) ? (
            <div className="panel muted">Connecting to mix engine…</div>
          ) : (
            deckNodes
          )}
        </section>

        <aside className="side-panel">
          <MasterPreview mixState={mixState} activeDeck={activeDeck} />
          <ContentBrowser
            assets={assets}
            onAssign={handleAssign}
            onRefresh={refreshAssets}
            activeDeckLabel={`Deck ${activeDeck + 1}`}
          />
        </aside>
      </main>
    </div>
  )
}
