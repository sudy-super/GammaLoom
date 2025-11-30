import { useEffect, useRef } from 'react'
import type { DeckState } from '@shared/types'

type DeckColumnProps = {
  deck: DeckState
  isActive: boolean
  onSelect: () => void
  onUpdate: (_patch: Partial<DeckState>) => void
}

export const DeckColumn = ({ deck, isActive, onSelect, onUpdate }: DeckColumnProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (deck.src && video.src !== deck.src) {
      video.src = deck.src
      video.load()
    }

    if (!deck.src) {
      video.removeAttribute('src')
      video.load()
    }

    video.muted = true
    video.loop = true
    video.playbackRate = deck.speed

    if (deck.playing && deck.src) {
      video
        .play()
        .catch(() => {
          /* ignored */
        })
    } else {
      video.pause()
    }
  }, [deck.playing, deck.speed, deck.src])

  const fileLabel = deck.src ? extractName(deck.src) : 'No asset loaded'

  return (
    <article className={`deck-column ${isActive ? 'is-active' : ''}`}>
      <header className="deck-column__header">
        <div>
          <p className="eyebrow">{deck.label}</p>
          <h2>Deck {deck.id + 1}</h2>
          <p className="deck-column__file" title={deck.src ?? undefined}>
            {fileLabel}
          </p>
        </div>
        <button className="ghost" type="button" onClick={onSelect}>
          {isActive ? 'Active' : 'Set Active'}
        </button>
      </header>

      <div className="deck-preview">
        <video ref={videoRef} playsInline muted loop />
      </div>

      <div className="deck-controls">
        <label>
          Opacity
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={deck.opacity}
            onChange={(event) => onUpdate({ opacity: Number(event.target.value) })}
          />
          <span>{deck.opacity.toFixed(2)}</span>
        </label>

        <label>
          Speed
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={deck.speed}
            onChange={(event) => onUpdate({ speed: Number(event.target.value) })}
          />
          <span>{deck.speed.toFixed(2)}x</span>
        </label>

        <div className="deck-buttons">
          <button
            type="button"
            className="primary"
            onClick={() => onUpdate({ playing: !deck.playing })}
            disabled={!deck.src}
          >
            {deck.playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate({
                playing: false,
                opacity: 0,
              })
            }
          >
            Fade Out
          </button>
        </div>
      </div>
    </article>
  )
}

const extractName = (url: string) => {
  try {
    const decoded = decodeURI(url)
    const parts = decoded.split(/[/\\]/)
    return parts[parts.length - 1] ?? decoded
  } catch (_error) {
    return url
  }
}
