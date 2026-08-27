import React, { createContext, useContext, useMemo, useState } from 'react';
import { CONTENT_VERSION, templateById, createStarterCollection } from '@sigilgrid/content';
import type { CardInstance } from '@sigilgrid/core';
import { createLocalSaveRepository, emptySave, type SaveGame, type SaveRepository } from './save.ts';

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
            }
          : {}),
      };
    } catch {
      return c;
    }
  });
}

type Ctx = {
  save: SaveGame;
  setSave: (s: SaveGame) => void;
  repo: SaveRepository;
  patch: (fn: (s: SaveGame) => SaveGame) => void;
};

const C = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const repo = useMemo(() => createLocalSaveRepository(), []);
  const [save, setSaveState] = useState<SaveGame>(() => {
    const loaded = repo.load();
    if (loaded) {
      const next =
        loaded.contentVersion === CONTENT_VERSION
          ? { ...loaded, collection: syncCollection(loaded.collection) }
          : {
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
      repo.save(next);
      return next;
    }
    const fresh = emptySave(createStarterCollection());
    repo.save(fresh);
    return fresh;
  });

  const setSave = (s: SaveGame) => {
    setSaveState(s);
    repo.save(s);
  };

  return (
    <C.Provider
      value={{
        save,
        setSave,
        repo,
        patch: (fn) => setSave(fn(save)),
      }}
    >
      {children}
    </C.Provider>
  );
}

export function useGame() {
  const v = useContext(C);
  if (!v) throw new Error('GameProvider required');
  return v;
}
