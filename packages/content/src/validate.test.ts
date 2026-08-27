import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateById } from './templates.ts';
import { validateTemplates } from './validate.ts';
import { ENCOUNTERS } from './campaign.ts';
import { STARTER_DECKS, ownedTemplateIds, pickPack } from './economy.ts';
import { createStarterCollection } from './instantiate.ts';

describe('content', () => {
  it('has the 100 Tetra Master cards with valid stats', () => {
    expect(TEMPLATES).toHaveLength(100);
    expect(validateTemplates()).toEqual([]);
    const goblin = templateById('goblin');
    expect(goblin.displayName).toBe('Goblin');
    expect(goblin.attack).toBe(0);
    expect(goblin.battleClass).toBe('P');
    expect(goblin.physicalDefense).toBe(0);
    expect(goblin.magicalDefense).toBe(0);
    const cactuar = templateById('cactuar');
    expect(cactuar.attack).toBe(3);
    expect(cactuar.physicalDefense).toBe(12);
    const alexander = templateById('alexander');
    expect(alexander.battleClass).toBe('M');
    expect(alexander.attack).toBe(13);
    expect(templateById('lizardman').displayName).toBe('Lizard Man');
    expect(templateById('zombie').battleClass).toBe('M');
    expect(templateById('ifrit').attack).toBe(6);
    expect(templateById('ifrit').physicalDefense).toBe(9);
    expect(templateById('mog').attack).toBe(1);
    expect(templateById('blue-narciss').attack).toBe(8);
    expect(templateById('blue-narciss').physicalDefense).toBe(8);
  });

  it('gives cards a partial set of directions', () => {
    expect(TEMPLATES.every((t) => t.defaultArrows.length >= 1 && t.defaultArrows.length <= 7)).toBe(true);
  });

  it('has 12 encounters and four starter decks of five', () => {
    expect(ENCOUNTERS).toHaveLength(12);
    for (const deck of Object.values(STARTER_DECKS)) expect(deck).toHaveLength(5);
    expect(createStarterCollection().length).toBeGreaterThanOrEqual(12);
    for (const e of ENCOUNTERS) {
      for (const id of e.opponentTemplates) templateById(id);
      for (const id of e.playerTemplates ?? []) templateById(id);
      for (const r of e.rewards) {
        if (r.kind === 'card') templateById(r.templateId);
      }
    }
  });

  it('can reach every template through play, capture, or the seal shop', () => {
    const reachable = ownedTemplateIds(createStarterCollection());
    for (const e of ENCOUNTERS) {
      for (const id of e.opponentTemplates) reachable.add(id);
      for (const r of e.rewards) {
        if (r.kind === 'card') reachable.add(r.templateId);
      }
    }
    for (const t of TEMPLATES) reachable.add(t.templateId);
    expect(reachable.size).toBe(TEMPLATES.length);
    const nearlyFull = createStarterCollection();
    const missing = TEMPLATES.filter((t) => !ownedTemplateIds(nearlyFull).has(t.templateId)).slice(0, 3);
    const pack = pickPack(nearlyFull, 42, 3);
    expect(pack.every((id) => missing.some((t) => t.templateId === id) || pack.length === 3)).toBe(true);
    expect(new Set(pack).size).toBe(pack.length);
  });
});
