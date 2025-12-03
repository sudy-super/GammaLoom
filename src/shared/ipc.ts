import type { Asset, DeckId, DeckState, MixState } from './types';

export const IPC_CHANNELS = {
  MIX_STATE: 'mix:state',
  MIX_GET_STATE: 'mix:getState',
  DECK_UPDATE: 'deck:update',
  MASTER_OPACITY: 'mix:setMasterOpacity',
  CROSS_FADER: 'mix:setCrossfader',
  ASSETS_LIST: 'assets:list',
} as const;

export type DeckUpdatePayload = {
  deckId: DeckId;
  patch: Partial<DeckState>;
};

export type MasterOpacityPayload = {
  value: number;
};

export type CrossfaderPayload = {
  target: 'ab' | 'ac' | 'bd' | 'cd';
  value: number;
};

export type MixStateResponse = MixState;
export type AssetsListResponse = Asset[];
