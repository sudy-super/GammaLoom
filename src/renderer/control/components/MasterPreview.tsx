import type { DeckId, MixState } from '@shared/types'
import { MixCanvas } from '@renderer/shared/components/MixCanvas'

type MasterPreviewProps = {
  mixState: MixState | null
  activeDeck: DeckId
}

export const MasterPreview = ({ mixState, activeDeck }: MasterPreviewProps) => {
  const deck = mixState?.decks.find((candidate) => candidate.id === activeDeck)
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Master Preview</p>
          <h3>Composite Output</h3>
        </div>
        <div className="panel__meta">
          <span>Deck {activeDeck + 1}</span>
          <span>{deck?.opacity !== undefined ? `${deck.opacity.toFixed(2)} opacity` : '—'}</span>
        </div>
      </div>
      <div className="preview-frame">
        <MixCanvas mixState={mixState} className="preview-frame__canvas" pixelRatio={0.65} />
      </div>
      <p className="panel__footer">
        Active source: {deck?.src ? extractName(deck.src) : 'No asset selected'}
      </p>
    </section>
  )
}

const extractName = (value: string) => {
  try {
    const decoded = decodeURI(value)
    const parts = decoded.split(/[/\\]/)
    return parts[parts.length - 1] ?? decoded
  } catch (_error) {
    return value
  }
}
