import React, { createContext, useContext, useMemo, useState } from 'react';
import { createStarterCollection } from '@sigilgrid/content';
import {
  createLocalSaveRepository,
  emptySave,
  reconcileSave,
  type SaveGame,
  type SaveRepository,
} from './save.ts';

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
      const next = reconcileSave(loaded);
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
