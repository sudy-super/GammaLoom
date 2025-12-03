export type DeckId = 0 | 1 | 2 | 3;

export type RendererRole = 'controller' | 'viewer';

export type DeckState = {
  id: DeckId;
  label: string;
  src: string | null;
  opacity: number;
  speed: number;
  playing: boolean;
  assetId: string | null;
  assetType: 'video' | 'shader' | 'generative' | null;
  enabled: boolean;
};

export type MixState = {
  decks: DeckState[];
  masterOpacity: number;
  crossfaderAB: number;
  crossfaderAC: number;
  crossfaderBD: number;
  crossfaderCD: number;
};

export type AssetKind = 'video' | 'image' | 'shader';

export type Asset = {
  id: string;
  path: string;
  url: string;
  name: string;
  kind: AssetKind;
  folder?: string;
  code?: string;
};
