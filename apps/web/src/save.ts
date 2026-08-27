import {
  CONTENT_VERSION,
  createStarterCollection,
  decksFromCollection,
  templateById,
} from '@sigilgrid/content';
import type { CardInstance } from '@sigilgrid/core';

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
  daily: { date: string; bestScore: number | null; packClaimed?: boolean };
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
  const decks = decksFromCollection(collection);
  return {
    version: 1,
    contentVersion: CONTENT_VERSION,
    collection,
    decks,
    activeDeckId: decks[0]?.id ?? 'beginner',
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

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A save is written to localStorage before it is ever rendered, so a
 * structurally broken import would brick the game on the next reload. Check
 * the shape up front rather than trusting `version`.
 */
export function isSaveGame(raw: unknown): raw is SaveGame {
  if (!isObj(raw) || raw.version !== 1) return false;
  if (typeof raw.contentVersion !== 'string') return false;
  if (!Array.isArray(raw.collection) || !raw.collection.every(isObj)) return false;
  if (!Array.isArray(raw.decks)) return false;
  if (!raw.decks.every((d) => isObj(d) && typeof d.id === 'string' && Array.isArray(d.instanceIds))) {
    return false;
  }
  if (typeof raw.activeDeckId !== 'string') return false;
  if (!isObj(raw.campaign) || !Array.isArray(raw.campaign.completed)) return false;
  if (!isObj(raw.settings) || !isObj(raw.daily)) return false;
  if (typeof raw.seals !== 'number' || !Number.isFinite(raw.seals)) return false;
  if (!Array.isArray(raw.loreIds) || !Array.isArray(raw.unlockedCosmetics)) return false;
  if (typeof raw.frameId !== 'string' || typeof raw.backId !== 'string') return false;
  if (!Array.isArray(raw.replays)) return false;
  return true;
}

function migrate(raw: unknown): SaveGame {
  if (!isSaveGame(raw)) {
    throw new Error('That file is not a Sigil Grid save.');
  }
  return raw;
}

/** Re-point cards at current template data, leaving earned progress alone. */
function syncCollection(cards: CardInstance[]): CardInstance[] {
  return cards.map((c) => {
    try {
      const t = templateById(c.templateId);
      const unupgraded = c.masteryLevel === 0 && c.battleHistory.wins === 0;
      return {
        ...c,
        displayName: t.displayName,
        ...(unupgraded
          ? {
              attack: t.attack,
              battleClass: t.battleClass,
              physicalDefense: t.physicalDefense,
              magicalDefense: t.magicalDefense,
              attackFine: c.attackFine ?? 0,
              physicalFine: c.physicalFine ?? 0,
              magicalFine: c.magicalFine ?? 0,
            }
          : {}),
      };
    } catch {
      return c;
    }
  });
}

/**
 * Bring a save from any source — localStorage or an imported file — up to the
 * current content version. Shared so an import cannot skip the step a normal
 * load performs.
 */
export function reconcileSave(loaded: SaveGame): SaveGame {
  if (loaded.contentVersion === CONTENT_VERSION) {
    return { ...loaded, collection: syncCollection(loaded.collection) };
  }
  return {
    ...emptySave(createStarterCollection()),
    settings: loaded.settings,
    campaign: loaded.campaign,
    unlockedCosmetics: loaded.unlockedCosmetics,
    frameId: loaded.frameId,
    backId: loaded.backId,
    seals: loaded.seals,
    loreIds: loaded.loreIds,
    wagerUnlocked: loaded.wagerUnlocked,
  };
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      const data = reconcileSave(migrate(parsed));
      this.save(data);
      return data;
    },
  };
}
