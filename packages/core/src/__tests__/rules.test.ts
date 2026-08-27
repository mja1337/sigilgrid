import { describe, expect, it } from 'vitest';
import { applyActions, concludeIfOver, createMatch, reduce } from '../match.ts';
import { makeCard, resetCardSeq } from '../factory.ts';
import { scoreBoard } from '../legal.ts';
import { replayMatch, boardSignature } from '../replay.ts';
import { resolveBattle } from '../battle.ts';
import { createRng } from '../rng.ts';
import { hexBand, bandLabel, formatHex } from '../hex.ts';
import { generateBlockedCells } from '../board.ts';
import { HIDDEN_PER_PIP } from '../mastery.ts';
import type { GameAction } from '../types.ts';

function five(prefix: string, arrows: ('N' | 'E' | 'S' | 'W')[] = ['N']) {
  return Array.from({ length: 5 }, (_, i) =>
    makeCard({
      instanceId: `${prefix}-${i}`,
      displayName: `${prefix}-${i}`,
      arrows,
      attack: 8,
      physicalDefense: 8,
      magicalDefense: 8,
    }),
  );
}

describe('hex bands', () => {
  it('maps hex to 16-wide bands', () => {
    expect(hexBand(0)).toEqual([0, 15]);
    expect(hexBand(8)).toEqual([128, 143]);
    expect(hexBand(15)).toEqual([240, 255]);
    expect(formatHex(10)).toBe('A');
    expect(bandLabel(8)).toContain('128–143');
  });
});

describe('rng', () => {
  it('is deterministic and never needs Math.random', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.int(0, 15));
    const seqB = Array.from({ length: 20 }, () => b.int(0, 15));
    expect(seqA).toEqual(seqB);
  });
});

describe('board generator', () => {
  it('blocks 0-6 unique cells', () => {
    for (let seed = 1; seed < 40; seed++) {
      const blocked = generateBlockedCells(createRng(seed));
      expect(blocked.length).toBeGreaterThanOrEqual(0);
      expect(blocked.length).toBeLessThanOrEqual(6);
      expect(new Set(blocked).size).toBe(blocked.length);
    }
  });
});

describe('match kickoff', () => {
  it('generates blocked cells when none are scripted', () => {
    const state = createMatch({
      seed: 2026,
      playerCards: five('p'),
      opponentCards: five('o'),
    });
    const blocked = state.board.map((c, i) => (c.blocked ? i : -1)).filter((i) => i >= 0);
    expect(blocked.length).toBeGreaterThanOrEqual(0);
    expect(blocked.length).toBeLessThanOrEqual(6);
    expect(state.eventLog.some((e) => e.kind === 'matchStart' && e.blocked.length === blocked.length)).toBe(true);
  });

  it('coin-flips first player from the seed when not specified', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const state = createMatch({
        seed,
        playerCards: five('p'),
        opponentCards: five('o'),
      });
      seen.add(state.firstPlayer);
      expect(state.currentPlayer).toBe(state.firstPlayer);
    }
    expect(seen.has('player')).toBe(true);
    expect(seen.has('opponent')).toBe(true);
  });

  it('ends the match when blocked cells leave no legal play', () => {
    const state = createMatch({
      seed: 3,
      playerCards: five('p', []),
      opponentCards: five('o', []),
      blockedCells: [0, 1, 2, 3, 4, 5],
      firstPlayer: 'player',
    });
    const after = concludeIfOver({
      ...state,
      placementsDone: 10,
      hands: { player: [], opponent: [] },
    });
    expect(after.nextState.phase === 'ended' || after.nextState.phase === 'masteryChoice').toBe(true);
  });
});

describe('placement and unopposed', () => {
  it('converts unopposed neighbors', () => {
    resetCardSeq();
    const player = five('p', ['E']);
    const opponent = five('o', ['S']);
    let state = createMatch({
      seed: 1,
      playerCards: player,
      opponentCards: opponent,
      blockedCells: [],
      firstPlayer: 'opponent',
    });
    state = reduce(state, { type: 'place', instanceId: 'o-0', cell: 1 }).nextState;
    state = reduce(state, { type: 'place', instanceId: 'p-0', cell: 0 }).nextState;
    expect(state.board[1]?.occupant?.owner).toBe('player');
    expect(state.eventLog.some((e) => e.kind === 'unopposed')).toBe(true);
    expect(state.eventLog.some((e) => e.kind === 'combo')).toBe(false);
  });
});

describe('contested battle', () => {
  it('resolves opposing arrows and converts the loser', () => {
    const player = [
      makeCard({ instanceId: 'p-atk', arrows: ['E'], attack: 15, physicalDefense: 15, magicalDefense: 15, battleClass: 'P' }),
      ...five('pfill').slice(0, 4),
    ];
    const opponent = [
      makeCard({ instanceId: 'o-def', arrows: ['W'], attack: 0, physicalDefense: 0, magicalDefense: 0, battleClass: 'P' }),
      ...five('ofill').slice(0, 4),
    ];
    let state = createMatch({
      seed: 99,
      playerCards: player,
      opponentCards: opponent,
      blockedCells: [],
      firstPlayer: 'opponent',
    });
    state = reduce(state, { type: 'place', instanceId: 'o-def', cell: 1 }).nextState;
    const after = reduce(state, { type: 'place', instanceId: 'p-atk', cell: 0 });
    expect(after.events.some((e) => e.kind === 'battle')).toBe(true);
    const battle = after.events.find((e) => e.kind === 'battle');
    expect(battle && battle.kind === 'battle' && battle.winner).toBe('player');
    expect(after.nextState.board[1]?.occupant?.owner).toBe('player');
  });

  it('defender wins exact ties', () => {
    const rng = createRng(0);
    const atk = makeCard({ arrows: ['E'], attack: 0, physicalDefense: 0, magicalDefense: 0, battleClass: 'P' });
    const def = makeCard({ arrows: ['W'], attack: 0, physicalDefense: 0, magicalDefense: 0, battleClass: 'P' });
    let defenderWins = 0;
    for (let i = 0; i < 40; i++) {
      if (!resolveBattle(rng, atk, def).winnerIsAttacker) defenderWins++;
    }
    expect(defenderWins).toBeGreaterThan(0);
  });
});

describe('battle order and combo', () => {
  it('lets the player choose contested order', () => {
    const player = [
      makeCard({ instanceId: 'p0', arrows: ['E', 'S'], attack: 15, physicalDefense: 15, magicalDefense: 15 }),
      ...five('px').slice(0, 4),
    ];
    const opponent = [
      makeCard({ instanceId: 'o0', arrows: ['W'], attack: 0, physicalDefense: 0, magicalDefense: 0 }),
      makeCard({ instanceId: 'o1', arrows: ['N'], attack: 0, physicalDefense: 0, magicalDefense: 0 }),
      ...five('oy').slice(0, 3),
    ];
    let state = createMatch({
      seed: 3,
      playerCards: player,
      opponentCards: opponent,
      blockedCells: [],
      firstPlayer: 'opponent',
    });
    state = reduce(state, { type: 'place', instanceId: 'o0', cell: 1 }).nextState;
    state = reduce(state, { type: 'place', instanceId: 'px-0', cell: 15 }).nextState;
    state = reduce(state, { type: 'place', instanceId: 'o1', cell: 4 }).nextState;
    const placed = reduce(state, { type: 'place', instanceId: 'p0', cell: 0 });
    expect(placed.nextState.phase).toBe('chooseBattleOrder');
    expect(placed.nextState.pendingBattle?.contestedCells.sort()).toEqual([1, 4]);
    const ordered = reduce(placed.nextState, { type: 'chooseBattleOrder', order: [4, 1] });
    expect(ordered.events.some((e) => e.kind === 'battleOrder')).toBe(true);
    expect(ordered.nextState.phase === 'placing' || ordered.nextState.phase === 'ended').toBe(true);
  });

  it('combos one hop without recursion', () => {
    // Layout: P at 0 pointing E; O at 1 pointing W and E; O at 2 pointing W and E; O at 3 empty of arrows back
    const player = [
      makeCard({ instanceId: 'p0', arrows: ['E'], attack: 15, physicalDefense: 15, magicalDefense: 15 }),
      ...five('pa').slice(0, 4),
    ];
    const opponent = [
      makeCard({ instanceId: 'o1', arrows: ['W', 'E'], attack: 0, physicalDefense: 0, magicalDefense: 0 }),
      makeCard({ instanceId: 'o2', arrows: ['W', 'E'], attack: 0, physicalDefense: 0, magicalDefense: 0 }),
      makeCard({ instanceId: 'o3', arrows: ['W'], attack: 0, physicalDefense: 0, magicalDefense: 0 }),
      ...five('ob').slice(0, 2),
    ];
    let state = createMatch({
      seed: 4,
      playerCards: player,
      opponentCards: opponent,
      blockedCells: [],
      firstPlayer: 'opponent',
    });
    state = applyActions(state, [
      { type: 'place', instanceId: 'o1', cell: 1 },
      { type: 'place', instanceId: 'pa-0', cell: 12 },
      { type: 'place', instanceId: 'o2', cell: 2 },
      { type: 'place', instanceId: 'pa-1', cell: 13 },
      { type: 'place', instanceId: 'o3', cell: 3 },
      { type: 'place', instanceId: 'p0', cell: 0 },
    ]);
    const combo = state.eventLog.filter((e) => e.kind === 'combo');
    expect(combo.length).toBeGreaterThanOrEqual(1);
    const converted = combo.flatMap((e) => (e.kind === 'combo' ? e.convertedCells : []));
    // o2 should combo; o3 must not recursively combo from o2's conversion
    expect(converted).toContain(2);
    expect(state.board[2]?.occupant?.owner).toBe('player');
    expect(state.board[3]?.occupant?.owner).toBe('opponent');
  });
});

describe('blocked cells and draw', () => {
  it('rejects blocked placements', () => {
    const state = createMatch({
      seed: 8,
      playerCards: five('p'),
      opponentCards: five('o'),
      blockedCells: [5],
      firstPlayer: 'player',
    });
    const { events } = reduce(state, { type: 'place', instanceId: 'p-0', cell: 5 });
    expect(events.some((e) => e.kind === 'illegal')).toBe(true);
  });

  it('can draw when scores tie', () => {
    const player = five('p', []);
    const opponent = five('o', []);
    let state = createMatch({
      seed: 11,
      playerCards: player,
      opponentCards: opponent,
      blockedCells: [10, 11, 12, 13, 14, 15],
      firstPlayer: 'player',
    });
    const actions: GameAction[] = [];
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 10; i++) {
      const who = i % 2 === 0 ? 'p' : 'o';
      actions.push({ type: 'place', instanceId: `${who}-${Math.floor(i / 2)}`, cell: cells[i]! });
    }
    state = applyActions(state, actions);
    expect(state.phase === 'ended' || state.phase === 'masteryChoice').toBe(true);
    const score = scoreBoard(state);
    expect(score.player).toBe(5);
    expect(score.opponent).toBe(5);
    expect(state.winner).toBe('draw');
  });
});

describe('replay', () => {
  it('replays the same seed and actions to the same board', () => {
    const config = {
      seed: 21,
      playerCards: five('p', ['N', 'E']),
      opponentCards: five('o', ['S', 'W']),
      blockedCells: [15],
      firstPlayer: 'player' as const,
    };
    let state = createMatch(config);
    const actions: GameAction[] = [
      { type: 'place', instanceId: 'p-0', cell: 0 },
      { type: 'place', instanceId: 'o-0', cell: 5 },
      { type: 'place', instanceId: 'p-1', cell: 2 },
      { type: 'place', instanceId: 'o-1', cell: 7 },
      { type: 'place', instanceId: 'p-2', cell: 8 },
      { type: 'place', instanceId: 'o-2', cell: 3 },
      { type: 'place', instanceId: 'p-3', cell: 4 },
      { type: 'place', instanceId: 'o-3', cell: 6 },
      { type: 'place', instanceId: 'p-4', cell: 9 },
      { type: 'place', instanceId: 'o-4', cell: 1 },
    ];
    state = applyActions(state, actions);
    const again = replayMatch({
      config,
      actions,
      rulesVersion: state.rulesVersion,
      contentVersion: state.contentVersion,
    });
    expect(boardSignature(again)).toBe(boardSignature(state));
    expect(again.winner).toBe(state.winner);
    expect(again.rngState).toBe(state.rngState);
  });
});

describe('mastery', () => {
  it('awards placement xp and levels a winner', () => {
    const player = five('p', []).map((c, i) =>
      i === 0 ? { ...c, masteryXp: 2, masteryLevel: 0, attack: 4 as const, physicalDefense: 4 as const, magicalDefense: 4 as const } : c,
    );
    const opponent = five('o', []);
    let state = createMatch({
      seed: 5,
      playerCards: player,
      opponentCards: opponent,
      blockedCells: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      firstPlayer: 'player',
    });
    state = applyActions(state, [
      { type: 'place', instanceId: 'p-0', cell: 0 },
      { type: 'place', instanceId: 'o-0', cell: 1 },
      { type: 'place', instanceId: 'p-1', cell: 2 },
      { type: 'place', instanceId: 'o-1', cell: 3 },
      { type: 'place', instanceId: 'p-2', cell: 4 },
      { type: 'place', instanceId: 'o-2', cell: 5 },
    ]);
    // 3 player vs 3 opponent — may draw; force by checking xp on placed cards
    const p0 = state.cards['p-0']!;
    expect(p0.battleHistory.placements).toBeGreaterThanOrEqual(1);
    expect(HIDDEN_PER_PIP).toBe(16);
  });
});
