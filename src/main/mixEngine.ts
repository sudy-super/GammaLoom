import { EventEmitter } from 'node:events'
import { createInitialMixState } from '@shared/constants'
import type { DeckId, DeckState, MixState } from '@shared/types'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const SPEED_RANGE = { min: 0.25, max: 4 }

export class MixEngine extends EventEmitter {
  private state: MixState

  constructor(initialState?: MixState) {
    super()
    this.state = initialState ?? createInitialMixState()
  }

  getState(): MixState {
    return cloneState(this.state)
  }

  updateDeck(id: DeckId, patch: Partial<DeckState>): MixState {
    const current = this.state.decks.find((deck) => deck.id === id)
    if (!current) {
      throw new Error(`Deck ${id} not found`)
    }

    const sanitized: DeckState = {
      ...current,
      ...patch,
    }

    if (patch.opacity !== undefined) {
      sanitized.opacity = clamp(Number(patch.opacity), 0, 1)
    }

    if (patch.speed !== undefined) {
      sanitized.speed = clamp(Number(patch.speed), SPEED_RANGE.min, SPEED_RANGE.max)
    }

    if (patch.playing !== undefined) {
      sanitized.playing = Boolean(patch.playing)
    }

    if (patch.enabled !== undefined) {
      sanitized.enabled = Boolean(patch.enabled)
    }

    this.state = {
      ...this.state,
      decks: this.state.decks.map((deck) => (deck.id === id ? sanitized : deck)),
    }

    return this.emitChange()
  }

  setMasterOpacity(value: number): MixState {
    const next = clamp(Number(value), 0, 1)
    if (next === this.state.masterOpacity) {
      return this.getState()
    }

    this.state = { ...this.state, masterOpacity: next }
    return this.emitChange()
  }

  setCrossfader(target: 'ab' | 'ac' | 'bd' | 'cd', value: number): MixState {
    const nextValue = clamp(Number(value), 0, 1)
    const keyMap: Record<typeof target, keyof MixState> = {
      ab: 'crossfaderAB',
      ac: 'crossfaderAC',
      bd: 'crossfaderBD',
      cd: 'crossfaderCD',
    }
    const stateKey = keyMap[target]
    if (this.state[stateKey] === nextValue) {
      return this.getState()
    }
    this.state = { ...this.state, [stateKey]: nextValue }
    return this.emitChange()
  }

  private emitChange(): MixState {
    const snapshot = this.getState()
    this.emit('stateChanged', snapshot)
    return snapshot
  }
}

const cloneState = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}
