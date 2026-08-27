import { CONTENT_VERSION } from '@sigilgrid/content';

export type Settings = {
  classicOpacity: boolean;
  tacticalPreview: boolean;
  fastResolve: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  highContrast: boolean;
};

export type DeckList = {
  id: string;
  name: string;
  instanceIds: string[];
};

export type CampaignSave = {
  completed: string[];
  nextId: string;
  epilogue?: 'seal' | 'use';
  finaleRound: number;
};

export type SaveGame = {
  version: 1;
  contentVersion: string;
  collection: import('@sigilgrid/core').CardInstance[];
  decks: DeckList[];
  activeDeckId: string;
  campaign: CampaignSave;
  settings: Settings;
  unlockedCosmetics: string[];
  frameId: string;
  backId: string;
  seals: number;
  loreIds: string[];
  wagerUnlocked: boolean;
  daily: { date: string; bestScore: number | null };
  replays: import('@sigilgrid/protocol').StoredReplay[];
};

export const SAVE_KEY = 'sigilgrid.save.v1';

export const defaultSettings = (): Settings => ({
  classicOpacity: false,
  tacticalPreview: true,
  fastResolve: true,
  animationSpeed: 'normal',
  highContrast: false,
});

export function emptySave(collection: SaveGame['collection']): SaveGame {
  const beginner = collection.slice(0, 5).map((c) => c.instanceId);
  return {
    version: 1,
    contentVersion: CONTENT_VERSION,
    collection,
    decks: [{ id: 'beginner', name: 'Beginner balanced', instanceIds: beginner }],
    activeDeckId: 'beginner',
    campaign: { completed: [], nextId: 't1', finaleRound: 0 },
    settings: defaultSettings(),
    unlockedCosmetics: ['frame-plain', 'back-plain'],
    frameId: 'frame-plain',
    backId: 'back-plain',
    seals: 0,
    loreIds: [],
    wagerUnlocked: false,
    daily: { date: '', bestScore: null },
    replays: [],
  };
}

export interface SaveRepository {
  load(): SaveGame | null;
  save(data: SaveGame): void;
  reset(): void;
  export(): string;
  import(json: string): SaveGame;
}

function migrate(raw: unknown): SaveGame {
  const data = raw as SaveGame;
  if (!data || data.version !== 1) {
    throw new Error('unsupported save');
  }
  return data;
}

export function createLocalSaveRepository(): SaveRepository {
  return {
    load() {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      try {
        return migrate(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save(data) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    },
    reset() {
      localStorage.removeItem(SAVE_KEY);
    },
    export() {
      const data = this.load();
      const safe = data ? { ...data, replays: data.replays } : null;
      return JSON.stringify(safe, null, 2);
    },
    import(json: string) {
      const data = migrate(JSON.parse(json));
      this.save(data);
      return data;
    },
  };
}
