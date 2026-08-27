import { estimateWinChance } from './battle.ts';
import { cloneState } from './clone.ts';
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

function captureScore(state: MatchState, instanceId: string, cell: number): number {
  const sim = cloneState(state);
  sim.board[cell] = {
    blocked: false,
    occupant: { instanceId, owner: sim.currentPlayer },
  };
  const contacts = contactsFrom(sim, cell);
  let score = contacts.filter((c) => !c.contested).length * 12;
  for (const c of contacts.filter((x) => x.contested)) {
    const def = sim.cards[sim.board[c.cell]!.occupant!.instanceId]!;
    const atk = sim.cards[instanceId]!;
    const p = estimateWinChance(state.rngState ^ cell, atk, def, 16);
    score += 8 * p;
    score += personalityCombo(sim, c.cell) * 4 * p;
  }
  score -= exposurePenalty(sim, cell, instanceId);
  return score;
}

function personalityCombo(state: MatchState, cell: number): number {
  const occ = state.board[cell]?.occupant;
  if (!occ) return 0;
  const card = state.cards[occ.instanceId];
  if (!card) return 0;
  return card.arrows.length;
}

function exposurePenalty(state: MatchState, cell: number, instanceId: string): number {
  const card = state.cards[instanceId]!;
  let open = 0;
  for (const dir of card.arrows) {
    // arrows are threats AND liabilities: count empty neighbors we point at
    void dir;
    open += 0.4;
  }
  return open + cell * 0;
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
      return bestBattleOrder(state);
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
      const cap = captureScore(state, m.instanceId, m.cell);
      const mat = scoreAfterPlace(state, action, me, personality);
      const total = mat + cap;
      if (total > bestScore) {
        bestScore = total;
        best = action;
      }
    }
    return best;
  },
};

function bestBattleOrder(state: MatchState): GameAction {
  const pending = state.pendingBattle!;
  const perms = permute(pending.contestedCells).slice(0, 24);
  const me = state.currentPlayer;
  let best = perms[0]!;
  let bestScore = -Infinity;
  for (const order of perms) {
    const { nextState, events } = reduce(state, { type: 'chooseBattleOrder', order });
    if (events.some((e) => e.kind === 'illegal')) continue;
    const s = material(nextState, me);
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
    if (state.phase === 'chooseBattleOrder') return bestBattleOrder(state);
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
      s += captureScore(state, m.instanceId, m.cell) * 0.25;
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
    const { nextState } = reduce(state, bestBattleOrder(state));
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
