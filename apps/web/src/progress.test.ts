import { describe, expect, it } from 'vitest';
import { createMatch } from '@sigilgrid/core';
import {
  CHALLENGES,
  COLLECTION_CAP,
  ENCOUNTERS,
  REPEAT_WIN_SEALS,
  createStarterCollection,
  instantiateId,
} from '@sigilgrid/content';
import {
  activeDeckSummary,
  applyMatchToSave,
  claimLoot,
  circuitFinished,
  deckCardsForMatch,
  grantStoryRewards,
  heldCardsForMatch,
  isReclaimableLoot,
  lootCandidates,
  wagerRivalUnlocked,
} from './progress.ts';
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

describe('deckCardsForMatch', () => {
  it('deals the active deck in its saved order', () => {
    const save = emptySave(createStarterCollection());
    const deck = save.decks.find((d) => d.id === save.activeDeckId)!;
    expect(deckCardsForMatch(save).map((c) => c.instanceId)).toEqual(deck.instanceIds);
  });

  it('fills an empty deck from the album so a match is never dealt short', () => {
    const base = emptySave(createStarterCollection());
    const save = {
      ...base,
      decks: [...base.decks, { id: 'custom-1', name: 'Custom 1', instanceIds: [] }],
      activeDeckId: 'custom-1',
    };
    const hand = deckCardsForMatch(save);
    expect(hand).toHaveLength(5);
    expect(new Set(hand.map((c) => c.instanceId)).size).toBe(5);
    expect(activeDeckSummary(save)).toMatchObject({ name: 'Custom 1', owned: 0, borrowed: 5 });
    expect(activeDeckSummary(save).mix).toMatch(/[PMXA]/);
    expect(activeDeckSummary(save).power).toBeGreaterThan(0);
  });

  it('tops up a half-built deck and reports how many were borrowed', () => {
    const base = emptySave(createStarterCollection());
    const picked = base.collection.slice(0, 2).map((c) => c.instanceId);
    const save = {
      ...base,
      decks: [...base.decks, { id: 'custom-1', name: 'Custom 1', instanceIds: picked }],
      activeDeckId: 'custom-1',
    };
    const hand = deckCardsForMatch(save);
    expect(hand).toHaveLength(5);
    expect(hand.slice(0, 2).map((c) => c.instanceId)).toEqual(picked);
    expect(activeDeckSummary(save).borrowed).toBe(3);
  });

  it('drops deck entries for cards that left the album', () => {
    const base = emptySave(createStarterCollection());
    const save = {
      ...base,
      decks: [...base.decks, { id: 'custom-1', name: 'Custom 1', instanceIds: ['gone-1', 'gone-2'] }],
      activeDeckId: 'custom-1',
    };
    const hand = deckCardsForMatch(save);
    expect(hand).toHaveLength(5);
    expect(hand.every((c) => base.collection.includes(c))).toBe(true);
  });
});

describe('applyMatchToSave', () => {
  it('increments a daily streak once per day and resets it after a missed day', () => {
    const save = emptySave(createStarterCollection());
    const dayOne = applyMatchToSave(save, {
      mode: 'daily',
      result: ended('player'),
      seed: 20260904,
      wager: false,
      dailyDate: '2026-09-04',
    });
    expect(dayOne.daily).toMatchObject({ streak: 1, lastWinDate: '2026-09-04' });

    const sameDay = applyMatchToSave(dayOne, {
      mode: 'daily',
      result: ended('player'),
      seed: 20260904,
      wager: false,
      dailyDate: '2026-09-04',
    });
    expect(sameDay.daily.streak).toBe(1);

    const dayTwo = applyMatchToSave(sameDay, {
      mode: 'daily',
      result: ended('player'),
      seed: 20260905,
      wager: false,
      dailyDate: '2026-09-05',
    });
    expect(dayTwo.daily.streak).toBe(2);

    const afterGap = applyMatchToSave(dayTwo, {
      mode: 'daily',
      result: ended('player'),
      seed: 20260907,
      wager: false,
      dailyDate: '2026-09-07',
    });
    expect(afterGap.daily).toMatchObject({ streak: 1, lastWinDate: '2026-09-07' });
  });

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
    // Spoils are offered, not taken automatically — claimLoot does that.
    expect(first.collection.some((c) => c.instanceId === 'taken-t1-lizardman')).toBe(false);
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

  it('offers every opponent card you flipped as loot, and claims only the pick', () => {
    const save = emptySave(createStarterCollection());
    const win = ended('player');
    const spoils = lootCandidates(win);
    expect(spoils.length).toBeGreaterThan(0);
    expect(spoils.every((c) => c.instanceId.startsWith('o-'))).toBe(true);

    const taken = claimLoot(save, spoils[0]!, 't1');
    expect(taken.collection.some((c) => c.instanceId === 'taken-t1-lizardman')).toBe(true);
    // Claiming the same spoil again must not duplicate it.
    expect(claimLoot(taken, spoils[0]!, 't1').collection).toHaveLength(taken.collection.length);
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

  it('gives a forfeited wager card to that opponent and lets the player reclaim it', () => {
    const save = emptySave(createStarterCollection());
    const encounter = ENCOUNTERS.find((entry) => entry.id === 'a2-road')!;
    const lostId = save.decks.find((deck) => deck.id === save.activeDeckId)!.instanceIds[0]!;
    const lostCard = save.collection.find((card) => card.instanceId === lostId)!;

    const afterLoss = applyMatchToSave(save, {
      mode: 'wager',
      encounter,
      result: ended('opponent'),
      seed: 88,
      wager: true,
    });

    expect(afterLoss.collection.some((card) => card.instanceId === lostId)).toBe(false);
    expect(afterLoss.decks.every((deck) => !deck.instanceIds.includes(lostId))).toBe(true);
    expect(afterLoss.opponentHoldings[encounter.id]?.[0]?.instanceId).toBe(lostCard.instanceId);
    expect(afterLoss.opponentHoldings[encounter.id]?.[0]?.masteryXp).toBe(9);

    const returning = heldCardsForMatch(afterLoss, encounter.id, 123);
    expect(returning).toHaveLength(1);
    expect(returning[0]?.templateId).toBe(lostCard.templateId);
    expect(returning[0]?.instanceId).toMatch(/^o-held-a2-road-/);
    expect(isReclaimableLoot(afterLoss, returning[0]!, encounter.id)).toBe(true);

    const reclaimed = claimLoot(afterLoss, returning[0]!, encounter.id);
    expect(reclaimed.collection.some((card) => card.instanceId === lostId)).toBe(true);
    expect(reclaimed.opponentHoldings[encounter.id]).toBeUndefined();
  });

  it('always fields the most recently forfeited card on the next wager', () => {
    const save = emptySave(createStarterCollection());
    const held = save.collection.slice(0, 2);
    const wagerSave = {
      ...save,
      opponentHoldings: { 'a2-road': held },
    };

    for (const seed of [1, 2, 88, 99999]) {
      const returning = heldCardsForMatch(wagerSave, 'a2-road', seed);
      expect(returning.some((card) => card.templateId === held[1]!.templateId)).toBe(true);
    }
  });

  it('keeps a reclaimable card with the opponent when the album is full', () => {
    const save = emptySave(createStarterCollection());
    const original = save.collection[0]!;
    const filler = Array.from({ length: COLLECTION_CAP }, (_, i) =>
      instantiateId('fang', i + 100, 'drop', `full-${i}`),
    );
    const wagerSave = {
      ...save,
      collection: filler,
      opponentHoldings: { 'a2-road': [original] },
    };
    const returning = heldCardsForMatch(wagerSave, 'a2-road', 1)[0]!;

    const refused = claimLoot(wagerSave, returning, 'a2-road');
    expect(refused.collection).toHaveLength(COLLECTION_CAP);
    expect(refused.opponentHoldings['a2-road']).toEqual([original]);
  });

  it('records challenge first-wins without packing loot, then pays a seal on replay', () => {
    const save = emptySave(createStarterCollection());
    const rite = CHALLENGES[0]!;
    const first = applyMatchToSave(save, {
      mode: 'challenge',
      encounter: rite,
      result: ended('player'),
      seed: 400,
      wager: false,
    });
    expect(first.campaign.challenges).toEqual([rite.id]);
    expect(first.seals).toBe(save.seals + 1);
    expect(first.collection).toHaveLength(save.collection.length);

    const replay = applyMatchToSave(first, {
      mode: 'challenge',
      encounter: rite,
      result: ended('player'),
      seed: 400,
      wager: false,
    });
    expect(replay.campaign.challenges).toEqual([rite.id]);
    expect(replay.seals).toBe(first.seals + REPEAT_WIN_SEALS);
  });

  it('unlocks wager rivals only after their story encounter', () => {
    const save = emptySave(createStarterCollection());
    expect(wagerRivalUnlocked(save, 'a2-road')).toBe(false);
    expect(circuitFinished(save)).toBe(false);
    const beaten = {
      ...save,
      campaign: { ...save.campaign, completed: ['a2-road', 'a4-r3'] },
    };
    expect(wagerRivalUnlocked(beaten, 'a2-road')).toBe(true);
    expect(wagerRivalUnlocked(beaten, 'a2-lock')).toBe(false);
    expect(circuitFinished(beaten)).toBe(true);
  });
});
