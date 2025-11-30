import type { DeckId, DeckState, MixState } from './types';

export const DECK_IDS: DeckId[] = [0, 1, 2, 3];

const LABELS = ['Deck A', 'Deck B', 'Deck C', 'Deck D'];

export const createDefaultDeck = (id: DeckId): DeckState => ({
  id,
  label: LABELS[id] ?? `Deck ${id + 1}`,
  src: null,
  opacity: 0,
  speed: 1,
  playing: false,
});

export const createInitialMixState = (): MixState => ({
  decks: DECK_IDS.map((id) => createDefaultDeck(id)),
  masterOpacity: 1,
});
