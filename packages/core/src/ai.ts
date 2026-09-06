import { estimateWinChance } from './battle.ts';
import { cloneState } from './clone.ts';
import { neighbor } from './directions.ts';
import { contactsFrom, legalCells, otherPlayer, scoreBoard } from './legal.ts';
import { applyActions, reduce } from './match.ts';
import type { AiPersonality, GameAction, MatchState, PlayerId } from './types.ts';

export type AiStrategy = {
  name: 'easy' | 'standard' | 'expert';
  choose(state: MatchState, personality?: AiPersonality): GameAction;
};

function placements(state: MatchState): { instanceId: string; cell: number }[] {
  const hand = state.hands[state.currentPlayer];
  const cells = legalCells(state);
  const out: { instanceId: string; cell: number }[] = [];
  for (const instanceId of hand) {
    for (const cell of cells) out.push({ instanceId, cell });
  }
  return out;
}

function hashPick(state: MatchState, n: number): number {
  if (n <= 0) return 0;
  return Math.abs((state.rngState ^ (state.version * 9973)) >>> 0) % n;
}

function captureScore(
  state: MatchState,
  instanceId: string,
  cell: number,
  personality?: AiPersonality,
): number {
  const sim = cloneState(state);
  sim.board[cell] = {
    blocked: false,
    occupant: { instanceId, owner: sim.currentPlayer },
  };
  const contacts = contactsFrom(sim, cell);
  const aggression = personality?.aggression ?? 0.5;
  const risk = personality?.riskTolerance ?? 0.5;
  const card = sim.cards[instanceId]!;
  let score = contacts.filter((c) => !c.contested).length * (18 * (1 - aggression) + 2);
  for (const c of contacts.filter((x) => x.contested)) {
    const def = sim.cards[sim.board[c.cell]!.occupant!.instanceId]!;
    const atk = sim.cards[instanceId]!;
    const p = estimateWinChance(state.rngState ^ cell, atk, def, 16);
    score += (4 + aggression * 28) * (0.35 + p);
    score += personalityCombo(sim, c.cell) * (1 + aggression * 5) * p;
  }
  score += (personality?.classBias?.[card.battleClass] ?? 0) * 12;
  score -= exposurePenalty(sim, cell, instanceId, risk);
  return score;
}

function personalityCombo(state: MatchState, cell: number): number {
  const occ = state.board[cell]?.occupant;
  if (!occ) return 0;
  const card = state.cards[occ.instanceId];
  if (!card) return 0;
  return card.arrows.length;
}

function exposurePenalty(state: MatchState, cell: number, instanceId: string, risk = 0.5): number {
  const card = state.cards[instanceId]!;
  let open = 0;
  for (const dir of card.arrows) {
    const n = neighbor(cell, dir);
    if (n === null) continue;
    const target = state.board[n];
    if (!target || target.blocked || target.occupant) continue;
    open += 1;
  }
  return open * (1.5 - risk);
}

export const easyAi: AiStrategy = {
  name: 'easy',
  choose(state) {
    if (state.phase === 'chooseBattleOrder' && state.pendingBattle) {
      const order = [...state.pendingBattle.contestedCells];
      const i = hashPick(state, order.length);
      if (i > 0) [order[0], order[i]] = [order[i]!, order[0]!];
      return { type: 'chooseBattleOrder', order };
    }
    if (state.phase === 'masteryChoice' && state.pendingMastery[0]) {
      return {
        type: 'chooseMasteryUpgrade',
        instanceId: state.pendingMastery[0].instanceId,
        optionIndex: 0,
      };
    }
    const moves = placements(state);
    if (moves.length === 0) {
      return { type: 'place', instanceId: state.hands[state.currentPlayer][0] ?? '_none', cell: -1 };
    }
    let best = moves[0]!;
    let bestScore = -Infinity;
    for (const m of moves) {
      const contacts = (() => {
        const sim = cloneState(state);
        sim.board[m.cell] = { blocked: false, occupant: { instanceId: m.instanceId, owner: sim.currentPlayer } };
        return contactsFrom(sim, m.cell).length;
      })();
      const jitter = hashPick(state, 5) * 0.01;
      const s = contacts + jitter;
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    if (hashPick(state, 4) === 0) best = moves[hashPick(state, moves.length)]!;
    return { type: 'place', instanceId: best.instanceId, cell: best.cell };
  },
};

function scoreAfterPlace(state: MatchState, action: GameAction, me: PlayerId, personality?: AiPersonality): number {
  const { nextState, events } = reduce(state, action);
  if (events.some((e) => e.kind === 'illegal')) return -1000;
  if (nextState.phase === 'chooseBattleOrder' && nextState.pendingBattle) {
    const order = [...nextState.pendingBattle.contestedCells];
    const resolved = reduce(nextState, { type: 'chooseBattleOrder', order }).nextState;
    return material(resolved, me, personality);
  }
  return material(nextState, me, personality);
}

export function scorePlacement(
  state: MatchState,
  instanceId: string,
  cell: number,
  personality?: AiPersonality,
): number {
  const action: GameAction = { type: 'place', instanceId, cell };
  const cap = captureScore(state, instanceId, cell, personality);
  const mat = scoreAfterPlace(state, action, state.currentPlayer, personality);
  return mat * (1.15 - aggressionWeight(personality)) + cap;
}

function aggressionWeight(personality?: AiPersonality): number {
  return (personality?.aggression ?? 0.5) * 0.55;
}

function material(state: MatchState, me: PlayerId, personality?: AiPersonality): number {
  const s = scoreBoard(state);
  const mine = me === 'player' ? s.player : s.opponent;
  const theirs = me === 'player' ? s.opponent : s.player;
  let v = (mine - theirs) * 10;
  if (personality) v *= 1 + personality.aggression * 0.15;
  return v;
}

export const standardAi: AiStrategy = {
  name: 'standard',
  choose(state, personality) {
    if (state.phase === 'chooseBattleOrder' && state.pendingBattle) {
      return bestBattleOrder(state, personality);
    }
    if (state.phase === 'masteryChoice' && state.pendingMastery[0]) {
      return {
        type: 'chooseMasteryUpgrade',
        instanceId: state.pendingMastery[0].instanceId,
        optionIndex: 0,
      };
    }
    const me = state.currentPlayer;
    const moves = placements(state);
    if (moves.length === 0) {
      return { type: 'place', instanceId: state.hands[me][0] ?? '_none', cell: -1 };
    }
    let best: GameAction = { type: 'place', instanceId: moves[0]!.instanceId, cell: moves[0]!.cell };
    let bestScore = -Infinity;
    for (const m of moves) {
      const action: GameAction = { type: 'place', instanceId: m.instanceId, cell: m.cell };
      const cap = captureScore(state, m.instanceId, m.cell, personality);
      const mat = scoreAfterPlace(state, action, me, personality);
      const total = mat * (1.15 - aggressionWeight(personality)) + cap;
      if (total > bestScore) {
        bestScore = total;
        best = action;
      }
    }
    return best;
  },
};

function bestBattleOrder(state: MatchState, personality?: AiPersonality): GameAction {
  const pending = state.pendingBattle!;
  const perms = permute(pending.contestedCells).slice(0, 24);
  const me = state.currentPlayer;
  let best = perms[0]!;
  let bestScore = -Infinity;
  for (const order of perms) {
    const { nextState, events } = reduce(state, { type: 'chooseBattleOrder', order });
    if (events.some((e) => e.kind === 'illegal')) continue;
    const s = material(nextState, me, personality);
    if (s > bestScore) {
      bestScore = s;
      best = order;
    }
  }
  return { type: 'chooseBattleOrder', order: best };
}

function permute(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const out: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) out.push([arr[i]!, ...p]);
  }
  return out;
}

export const expertAi: AiStrategy = {
  name: 'expert',
  choose(state, personality) {
    if (state.phase === 'chooseBattleOrder') return bestBattleOrder(state, personality);
    if (state.phase === 'masteryChoice' && state.pendingMastery[0]) {
      return {
        type: 'chooseMasteryUpgrade',
        instanceId: state.pendingMastery[0].instanceId,
        optionIndex: 0,
      };
    }
    const me = state.currentPlayer;
    const deadline = Date.now() + 28;
    const moves = placements(state);
    if (moves.length === 0) {
      return { type: 'place', instanceId: state.hands[me][0] ?? '_none', cell: -1 };
    }
    let best: GameAction = { type: 'place', instanceId: moves[0]!.instanceId, cell: moves[0]!.cell };
    let bestScore = -Infinity;
    for (const m of moves) {
      if (Date.now() > deadline) break;
      const action: GameAction = { type: 'place', instanceId: m.instanceId, cell: m.cell };
      const { nextState, events } = reduce(state, action);
      if (events.some((e) => e.kind === 'illegal')) continue;
      let s = expectimax(nextState, me, 1, deadline, personality);
      s += captureScore(state, m.instanceId, m.cell, personality) * 0.25;
      if (s > bestScore) {
        bestScore = s;
        best = action;
      }
    }
    return best;
  },
};

function expectimax(
  state: MatchState,
  me: PlayerId,
  depth: number,
  deadline: number,
  personality?: AiPersonality,
): number {
  if (Date.now() > deadline) return material(state, me, personality);
  if (state.phase === 'ended' || state.phase === 'masteryChoice') return material(state, me, personality);
  if (state.phase === 'chooseBattleOrder') {
    const { nextState } = reduce(state, bestBattleOrder(state, personality));
    return expectimax(nextState, me, depth, deadline, personality);
  }
  if (depth <= 0) return material(state, me, personality);

  const moves = placements(state);
  if (moves.length === 0) return material(state, me, personality);
  const maximizing = state.currentPlayer === me;
  let best = maximizing ? -Infinity : Infinity;
  const limited = moves.slice(0, 18);
  for (const m of limited) {
    if (Date.now() > deadline) break;
    const { nextState, events } = reduce(state, { type: 'place', instanceId: m.instanceId, cell: m.cell });
    if (events.some((e) => e.kind === 'illegal')) continue;
    const v = expectimax(nextState, me, depth - 1, deadline, personality);
    if (maximizing) best = Math.max(best, v);
    else best = Math.min(best, v);
  }
  if (!Number.isFinite(best)) return material(state, me, personality);
  return best;
}

export function strategyByName(name: AiStrategy['name']): AiStrategy {
  if (name === 'easy') return easyAi;
  if (name === 'expert') return expertAi;
  return standardAi;
}

export function autoPlayToEnd(state: MatchState, playerAi: AiStrategy, oppAi: AiStrategy): MatchState {
  let cur = state;
  const actions: GameAction[] = [];
  let guard = 80;
  while (cur.phase !== 'ended' && cur.phase !== 'masteryChoice' && guard-- > 0) {
    const ai = cur.currentPlayer === 'player' ? playerAi : oppAi;
    const action = ai.choose(cur);
    actions.push(action);
    cur = reduce(cur, action).nextState;
  }
  while (cur.phase === 'masteryChoice' && cur.pendingMastery[0] && guard-- > 0) {
    cur = reduce(cur, playerAi.choose(cur)).nextState;
  }
  void otherPlayer;
  void applyActions;
  return cur;
}
