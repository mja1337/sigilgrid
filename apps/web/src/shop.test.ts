import { describe, expect, it } from 'vitest';
import { createStarterCollection, PACK_TIERS, COLLECTION_CAP, instantiateId } from '@sigilgrid/content';
import { emptySave } from './save.ts';
import { buyPackTier, discardCard, freeSlots, claimLoot, CAP } from './progress.ts';

const base = () => ({ ...emptySave(createStarterCollection()), seals: 50 });

describe('pack shop', () => {
  it('charges the tier price and returns what was pulled', () => {
    for (const tier of PACK_TIERS) {
      const save = base();
      const res = buyPackTier(save, tier.id, 5);
      if (typeof res === 'string') throw new Error(res);
      expect(res.save.seals).toBe(save.seals - tier.cost);
      expect(res.pulled).toHaveLength(tier.size);
      expect(res.save.collection).toHaveLength(save.collection.length + tier.size);
    }
  });

  it('refuses a pack you cannot afford and says how short you are', () => {
    const save = { ...base(), seals: 1 };
    const res = buyPackTier(save, 'lantern', 1);
    expect(typeof res).toBe('string');
    expect(res).toMatch(/9 more/);
  });

  it('refuses to overfill the album rather than silently dropping cards', () => {
    const filler = Array.from({ length: COLLECTION_CAP - 2 }, (_, i) =>
      instantiateId('goblin', i, 'drop', `filler-${i}`),
    );
    const save = { ...base(), collection: filler };
    expect(freeSlots(save)).toBe(2);
    const res = buyPackTier(save, 'ashfall', 1); // needs 3 slots
    expect(typeof res).toBe('string');
    expect(res).toMatch(/album space/i);
  });

  it('never exceeds the cap', () => {
    let save = base();
    for (let i = 0; i < 60; i++) {
      const res = buyPackTier({ ...save, seals: 99 }, 'lantern', i);
      if (typeof res === 'string') break;
      save = res.save;
    }
    expect(save.collection.length).toBeLessThanOrEqual(CAP);
  });
});

describe('discard', () => {
  it('removes the card from the album and from every deck', () => {
    const save = base();
    const victim = save.decks[0]!.instanceIds[0]!;
    const next = discardCard(save, victim);
    expect(next.collection.some((c) => c.instanceId === victim)).toBe(false);
    expect(next.decks.every((d) => !d.instanceIds.includes(victim))).toBe(true);
  });
});

describe('story loot', () => {
  const prize = instantiateId('shiva', 1, 'drop', 'o-shiva-0');

  it('adds a chosen spoil once', () => {
    const save = base();
    const once = claimLoot(save, prize, 't1');
    expect(once.collection).toHaveLength(save.collection.length + 1);
    const twice = claimLoot(once, prize, 't1');
    expect(twice.collection).toHaveLength(once.collection.length);
  });

  it('refuses when the album is full', () => {
    const filler = Array.from({ length: COLLECTION_CAP }, (_, i) =>
      instantiateId('goblin', i, 'drop', `filler-${i}`),
    );
    const save = { ...base(), collection: filler };
    expect(claimLoot(save, prize, 't1').collection).toHaveLength(COLLECTION_CAP);
  });
});
