import { describe, expect, it, beforeEach } from 'vitest';
import { createStarterCollection } from '@sigilgrid/content';
import { createLocalSaveRepository, emptySave, isSaveGame } from './save.ts';

// The suite runs in node; the repository only needs these four methods.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

const fresh = () => emptySave(createStarterCollection());

describe('save import validation', () => {
  beforeEach(() => localStorage.clear());

  it('accepts a save it just exported', () => {
    const repo = createLocalSaveRepository();
    repo.save(fresh());
    const round = repo.import(repo.export());
    expect(round.collection).toHaveLength(12);
    expect(round.version).toBe(1);
  });

  it('rejects malformed JSON without touching the stored save', () => {
    const repo = createLocalSaveRepository();
    const before = fresh();
    repo.save(before);
    expect(() => repo.import('{not json')).toThrow(/valid JSON/);
    expect(repo.load()?.collection).toHaveLength(12);
  });

  // The dangerous case: version says 1, so the old check waved it through and
  // wrote it to localStorage, crashing the app on every subsequent load.
  it.each([
    ['missing collection', { version: 1, contentVersion: '2.1.0' }],
    ['collection not an array', { ...fresh(), collection: 'nope' }],
    ['decks missing instanceIds', { ...fresh(), decks: [{ id: 'a', name: 'a' }] }],
    ['campaign not an object', { ...fresh(), campaign: null }],
    ['seals not a number', { ...fresh(), seals: 'lots' }],
    ['wrong version', { ...fresh(), version: 2 }],
  ])('rejects %s and leaves the stored save intact', (_label, bad) => {
    const repo = createLocalSaveRepository();
    repo.save(fresh());
    expect(() => repo.import(JSON.stringify(bad))).toThrow(/not a Sigil Grid save/);
    expect(repo.load()?.collection).toHaveLength(12);
  });

  it('guards the shape directly', () => {
    expect(isSaveGame(fresh())).toBe(true);
    expect(isSaveGame(null)).toBe(false);
    expect(isSaveGame({ version: 1 })).toBe(false);
  });
});
