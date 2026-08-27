import { describe, expect, it } from 'vitest';
import { createMatch } from '@sigilgrid/core';
import {
  ENCOUNTERS,
  REPEAT_WIN_SEALS,
  createStarterCollection,
  instantiateId,
} from '@sigilgrid/content';
import { applyMatchToSave, buyTemplate, grantStoryRewards } from './progress.ts';
import { emptySave } from './save.ts';

function ended(winner: 'player' | 'opponent' | 'draw', extra: Parameters<typeof createMatch>[0] extends never ? never : Partial<ReturnType<typeof createMatch>> = {}) {
  const player = [instantiateId('goblin', 1, 'starter', 'starter-goblin')];
  const opponent = [instantiateId('lizardman', 2, 'event', 'o-lizardman-0')];
  const base = createMatch({
    seed: 1,
    playerCards: player,
    opponentCards: opponent,
    blockedCells: [],
    firstPlayer: 'player',
  });
  return {
    ...base,
    phase: 'ended' as const,
    winner,
    cards: {
      ...base.cards,
      'starter-goblin': { ...base.cards['starter-goblin']!, masteryXp: 9 },
    },
    board: base.board.map((cell, i) =>
      i === 0
        ? { blocked: false, occupant: { instanceId: 'o-lizardman-0', owner: 'player' as const } }
        : cell,
    ),
    ...extra,
  };
}

describe('applyMatchToSave', () => {
  it('does not complete a story encounter on a loss', () => {
    const save = emptySave(createStarterCollection());
    const next = applyMatchToSave(save, {
      mode: 'story',
      encounter: ENCOUNTERS[0],
      result: ended('opponent'),
      seed: 40,
      wager: false,
    });
    expect(next.campaign.completed).toEqual([]);
    expect(next.campaign.nextId).toBe('t1');
    expect(next.collection.some((c) => c.instanceId.startsWith('reward-'))).toBe(false);
    expect(next.collection.find((c) => c.instanceId === 'starter-goblin')?.masteryXp).toBe(9);
  });

  it('grants unique first-win rewards once and a seal on replay', () => {
    const save = emptySave(createStarterCollection());
    const win = ended('player');
    const first = applyMatchToSave(save, {
      mode: 'story',
      encounter: ENCOUNTERS[0],
      result: win,
      seed: 40,
      wager: false,
    });
    expect(first.campaign.completed).toEqual(['t1']);
    expect(first.campaign.nextId).toBe('t2');
    expect(first.collection.filter((c) => c.instanceId === 'reward-t1-cactuar')).toHaveLength(1);
    expect(first.collection.some((c) => c.instanceId === 'taken-t1-lizardman')).toBe(true);
    const before = first.collection.filter((c) => c.instanceId.startsWith('reward-')).length;
    const replay = applyMatchToSave(first, {
      mode: 'story',
      encounter: ENCOUNTERS[0],
      result: win,
      seed: 40,
      wager: false,
    });
    expect(replay.collection.filter((c) => c.instanceId.startsWith('reward-'))).toHaveLength(before);
    expect(replay.collection.filter((c) => c.instanceId === 'reward-t1-cactuar')).toHaveLength(1);
    expect(replay.seals).toBe(first.seals + REPEAT_WIN_SEALS);
    expect(JSON.stringify(grantStoryRewards(save, ENCOUNTERS[0], 40))).not.toMatch(/Date\.now/);
  });

  it('does not use Date.now in story reward instance ids', () => {
    const save = emptySave(createStarterCollection());
    const next = grantStoryRewards(save, ENCOUNTERS[0], 99);
    for (const card of next.collection) {
      expect(card.instanceId).not.toMatch(/\d{12,}/);
      expect(card.instanceId.includes(String(Date.now()).slice(0, 8))).toBe(false);
    }
    expect(next.collection.some((c) => c.instanceId === 'reward-t1-cactuar')).toBe(true);
  });

  it('sells a missing unique from the shop once', () => {
    const save = { ...emptySave(createStarterCollection()), seals: 10 };
    const bought = buyTemplate(save, 'ramuh');
    expect(typeof bought).not.toBe('string');
    if (typeof bought === 'string') return;
    expect(bought.collection.some((c) => c.instanceId === 'shop-ramuh')).toBe(true);
    expect(buyTemplate(bought, 'ramuh')).toBe('You already own this card.');
  });

  it('does not inject story loaner cards into the collection', () => {
    const save = emptySave(createStarterCollection());
    const win = ended('player');
    const result = {
      ...win,
      cards: { ...win.cards, 'p-goblin-0': instantiateId('goblin', 3, 'starter', 'p-goblin-0') },
    };
    const next = applyMatchToSave(save, {
      mode: 'story',
      encounter: ENCOUNTERS[0],
      result,
      seed: 40,
      wager: false,
    });
    expect(next.collection.some((c) => c.instanceId.startsWith('p-'))).toBe(false);
  });
});
