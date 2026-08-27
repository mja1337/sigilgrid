import { describe, expect, it } from 'vitest';
import type { CardInstance } from '@sigilgrid/core';
import { createStarterCollection, instantiateId } from './instantiate.ts';
import { ownedTemplateIds, PACK_TIERS, pickPack, rollPack } from './economy.ts';
import { TEMPLATES, templateById } from './templates.ts';

describe('economy', () => {
  it('prefers unowned templates in a pack', () => {
    const owned = createStarterCollection();
    const unowned = TEMPLATES.filter((t) => !ownedTemplateIds(owned).has(t.templateId));
    const pack = pickPack(owned, 7, 3);
    expect(pack).toHaveLength(3);
    expect(pack.every((id) => unowned.some((t) => t.templateId === id))).toBe(true);
    expect(new Set(pack).size).toBe(3);
  });
});

describe('pack tiers', () => {
  const empty: CardInstance[] = [];

  it('every tier is affordable-to-expensive with sane weights', () => {
    expect(PACK_TIERS.map((t) => t.cost)).toEqual([2, 5, 10]);
    for (const t of PACK_TIERS) {
      const total = Object.values(t.weights).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
      expect(t.size).toBeGreaterThan(0);
    }
  });

  it('draws exactly the tier size', () => {
    for (const t of PACK_TIERS) {
      for (let seed = 1; seed < 12; seed++) {
        expect(rollPack(t, empty, seed)).toHaveLength(t.size);
      }
    }
  });

  it('never repeats a card inside one pack', () => {
    for (const t of PACK_TIERS) {
      for (let seed = 1; seed < 40; seed++) {
        const ids = rollPack(t, empty, seed);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('honours the rare floor on the guaranteed tier', () => {
    const lantern = PACK_TIERS.find((t) => t.id === 'lantern')!;
    for (let seed = 1; seed < 60; seed++) {
      const ids = rollPack(lantern, empty, seed);
      const best = ids.map((id) => templateById(id).rarity);
      expect(best.some((r) => r === 'rare' || r === 'relic')).toBe(true);
    }
  });

  it('prefers cards you do not own', () => {
    const ashfall = PACK_TIERS.find((t) => t.id === 'ashfall')!;
    const owned = rollPack(ashfall, empty, 3).map((id) =>
      instantiateId(id, 1, 'drop', `own-${id}`),
    );
    for (let seed = 1; seed < 25; seed++) {
      const next = rollPack(ashfall, owned, seed);
      for (const id of next) {
        expect(owned.some((c) => c.templateId === id)).toBe(false);
      }
    }
  });

  it('shifts the rarity mix upward as the tier price rises', () => {
    const share = (tierId: string) => {
      const tier = PACK_TIERS.find((t) => t.id === tierId)!;
      let good = 0;
      let n = 0;
      for (let seed = 1; seed < 300; seed++) {
        for (const id of rollPack(tier, empty, seed)) {
          const r = templateById(id).rarity;
          if (r === 'rare' || r === 'relic') good++;
          n++;
        }
      }
      return good / n;
    };
    const ash = share('ashfall');
    const ember = share('ember');
    const lantern = share('lantern');
    expect(ember).toBeGreaterThan(ash);
    expect(lantern).toBeGreaterThan(ember);
  });
});
