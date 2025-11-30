import { useEffect, useRef } from 'react'
import { DECK_IDS } from '@shared/constants'
import type { MixState } from '@shared/types'

const DEFAULT_RATIO = typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1

export type MixCanvasProps = {
  mixState: MixState | null
  className?: string
  pixelRatio?: number
}

export const MixCanvas = ({ mixState, className, pixelRatio = DEFAULT_RATIO }: MixCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({
    0: null,
    1: null,
    2: null,
    3: null,
  })

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const canvas = canvasRef.current
    if (!canvas) return
    const container = canvas.parentElement ?? canvas
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const width = entry?.contentRect?.width ?? container.clientWidth
      const height = entry?.contentRect?.height ?? container.clientHeight
      canvas.width = Math.max(1, Math.floor(width * pixelRatio))
      canvas.height = Math.max(1, Math.floor(height * pixelRatio))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [pixelRatio])

  useEffect(() => {
    if (!mixState) return
    for (const deck of mixState.decks) {
      const video = videoRefs.current[deck.id]
      if (!video) continue
      if (deck.src) {
        if (video.src !== deck.src) {
          video.src = deck.src
          video.load()
        }
      } else if (video.src) {
        video.removeAttribute('src')
        video.load()
      }
      video.playbackRate = deck.speed
      video.loop = true
      video.muted = true
      if (deck.playing && deck.src) {
        video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }
  }, [mixState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let animationFrame: number | null = null

    const render = () => {
      const { width, height } = canvas
      context.clearRect(0, 0, width, height)
      if (mixState) {
        for (const deck of mixState.decks) {
          if (deck.opacity <= 0) continue
          const video = videoRefs.current[deck.id]
          if (!video || video.readyState < 2) continue
          context.globalAlpha = deck.opacity * mixState.masterOpacity
          context.drawImage(video, 0, 0, width, height)
        }
        context.globalAlpha = 1
      }
      animationFrame = window.requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [mixState])

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="mix-canvas" />
      <div className="mix-video-pool" aria-hidden>
        {DECK_IDS.map((deckId) => (
          <video
            key={deckId}
            ref={(element) => {
              videoRefs.current[deckId] = element
            }}
            muted
            playsInline
            preload="auto"
          />
        ))}
      </div>
    </div>
  )
}
