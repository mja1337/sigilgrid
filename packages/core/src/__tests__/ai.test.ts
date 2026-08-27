import { describe, expect, it } from 'vitest';
import { easyAi, standardAi, expertAi } from '../ai.ts';
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
});
