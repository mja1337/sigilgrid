import { describe, expect, it } from 'vitest';
import { easyAi, standardAi, expertAi, scorePlacement } from '../ai.ts';
import { createMatch, reduce } from '../match.ts';
import { makeCard } from '../factory.ts';
import { legalCells } from '../legal.ts';

function deck(prefix: string) {
  return Array.from({ length: 5 }, (_, i) =>
    makeCard({ instanceId: `${prefix}-${i}`, arrows: ['N', 'E', 'S'], attack: 7, physicalDefense: 6, magicalDefense: 6 }),
  );
}

describe('AI', () => {
  it('easy returns a legal place', () => {
    const state = createMatch({
      seed: 9,
      playerCards: deck('p'),
      opponentCards: deck('o'),
      blockedCells: [],
      firstPlayer: 'player',
    });
    const action = easyAi.choose(state);
    expect(action.type).toBe('place');
    if (action.type === 'place') {
      expect(legalCells(state)).toContain(action.cell);
    }
  });

  it('standard and expert produce legal actions', () => {
    let state = createMatch({
      seed: 12,
      playerCards: deck('p'),
      opponentCards: deck('o'),
      blockedCells: [15],
      firstPlayer: 'player',
    });
    const a = standardAi.choose(state);
    state = reduce(state, a).nextState;
    const b = expertAi.choose(state);
    expect(['place', 'chooseBattleOrder']).toContain(b.type);
  });

  it('Len takes the safe unopposed P flip; Page Twelve takes the contested X fight', () => {
    const opp = makeCard({
      instanceId: 'o-warden',
      arrows: ['S'],
      battleClass: 'P',
      attack: 8,
      physicalDefense: 1,
      magicalDefense: 1,
    });
    const safe = makeCard({
      instanceId: 'p-safe',
      arrows: ['E'],
      battleClass: 'P',
      attack: 6,
      physicalDefense: 6,
      magicalDefense: 6,
    });
    const risky = makeCard({
      instanceId: 'p-risk',
      arrows: ['N'],
      battleClass: 'X',
      attack: 14,
      physicalDefense: 4,
      magicalDefense: 4,
    });
    const extras = Array.from({ length: 4 }, (_, i) =>
      makeCard({ instanceId: `o-pad-${i}`, arrows: ['N'], attack: 4, physicalDefense: 4, magicalDefense: 4 }),
    );
    let state = createMatch({
      seed: 21,
      playerCards: [safe, risky],
      opponentCards: [opp, ...extras],
      blockedCells: [0, 2, 3, 6, 7, 8, 10, 11, 12, 13, 14, 15],
      firstPlayer: 'opponent',
    });
    state = reduce(state, { type: 'place', instanceId: 'o-warden', cell: 5 }).nextState;
    expect(state.currentPlayer).toBe('player');

    const len = { aggression: 0.2, classBias: { P: 1 }, riskTolerance: 0.3 };
    const page = { aggression: 0.85, classBias: { X: 1 }, riskTolerance: 0.75 };
    const lenMove = standardAi.choose(state, len);
    const pageMove = standardAi.choose(state, page);
    expect(lenMove).toEqual({ type: 'place', instanceId: 'p-safe', cell: 4 });
    expect(pageMove).toEqual({ type: 'place', instanceId: 'p-risk', cell: 9 });
    expect(scorePlacement(state, 'p-safe', 4, len)).toBeGreaterThan(scorePlacement(state, 'p-risk', 9, len));
    expect(scorePlacement(state, 'p-risk', 9, page)).toBeGreaterThan(scorePlacement(state, 'p-safe', 4, page));
  });
});
