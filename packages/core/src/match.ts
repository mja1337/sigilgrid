import { resolveBattle } from './battle.ts';
import { applyBlocks, emptyBoard, generateBlockedCells } from './board.ts';
import { cloneCard, cloneState } from './clone.ts';
import { neighbor } from './directions.ts';
import { asHex } from './hex.ts';
import { contactsFrom, legalCells, otherPlayer, scoreBoard } from './legal.ts';
import { canLevel, eligibleStats, isChoiceLevel, MASTERY_CAP, xpToNext } from './mastery.ts';
import { createRng, rngFromState, type Rng } from './rng.ts';
import type {
  CardInstance,
  GameAction,
  Hex,
  MatchConfig,
  MatchEvent,
  MatchState,
  NumericStat,
  PlayerId,
  ReduceResult,
} from './types.ts';
import { RULES_VERSION } from './types.ts';

let eventSeq = 0;
function eid(): string {
  eventSeq += 1;
  return `e${eventSeq}`;
}

function attachEvent(state: MatchState, event: MatchEvent): MatchEvent {
  state.eventLog = [...state.eventLog, event];
  return event;
}

function convertCell(state: MatchState, cell: number, to: PlayerId): void {
  const occ = state.board[cell]?.occupant;
  if (!occ) return;
  state.board[cell] = { blocked: false, occupant: { instanceId: occ.instanceId, owner: to } };
}

function applyCombo(state: MatchState, loserCell: number, winnerOwner: PlayerId, events: MatchEvent[]): void {
  const occ = state.board[loserCell]?.occupant;
  if (!occ) return;
  const loser = state.cards[occ.instanceId];
  if (!loser) return;
  const converted: number[] = [];
  for (const dir of loser.arrows) {
    const n = neighbor(loserCell, dir);
    if (n === null) continue;
    const target = state.board[n]?.occupant;
    if (!target) continue;
    if (target.owner === winnerOwner) continue;
    convertCell(state, n, winnerOwner);
    converted.push(n);
  }
  if (converted.length) {
    events.push(
      attachEvent(state, {
        id: eid(),
        kind: 'combo',
        fromCell: loserCell,
        convertedCells: converted,
        to: winnerOwner,
      }),
    );
  }
}

function recordBattleHistory(
  state: MatchState,
  attackerId: string,
  defenderId: string,
  attackerWon: boolean,
): void {
  const a = state.cards[attackerId];
  const d = state.cards[defenderId];
  if (a) {
    a.battleHistory = {
      ...a.battleHistory,
      wins: a.battleHistory.wins + (attackerWon ? 1 : 0),
      losses: a.battleHistory.losses + (attackerWon ? 0 : 1),
    };
  }
  if (d) {
    d.battleHistory = {
      ...d.battleHistory,
      wins: d.battleHistory.wins + (attackerWon ? 0 : 1),
      losses: d.battleHistory.losses + (attackerWon ? 1 : 0),
    };
  }
}

function fight(
  state: MatchState,
  rng: Rng,
  placedCell: number,
  targetCell: number,
  events: MatchEvent[],
): void {
  const placedOcc = state.board[placedCell]?.occupant;
  const targetOcc = state.board[targetCell]?.occupant;
  if (!placedOcc || !targetOcc) return;
  if (placedOcc.owner === targetOcc.owner) return;
  const attacker = state.cards[placedOcc.instanceId];
  const defender = state.cards[targetOcc.instanceId];
  if (!attacker || !defender) return;

  const { winnerIsAttacker, detail } = resolveBattle(rng, attacker, defender);
  const winnerOwner = winnerIsAttacker ? placedOcc.owner : targetOcc.owner;
  const loserCell = winnerIsAttacker ? targetCell : placedCell;

  recordBattleHistory(state, attacker.instanceId, defender.instanceId, winnerIsAttacker);

  events.push(
    attachEvent(state, {
      id: eid(),
      kind: 'battle',
      placedCell,
      targetCell,
      attackerId: attacker.instanceId,
      defenderId: defender.instanceId,
      detail,
      winner: winnerOwner,
    }),
  );

  convertCell(state, loserCell, winnerOwner);
  applyCombo(state, loserCell, winnerOwner, events);

  const winnerCard = winnerIsAttacker ? attacker : defender;
  maybeEvolve(state, rng, winnerCard, events, new Date(0).toISOString());
}

function remainingContested(state: MatchState, placedCell: number, remaining: number[]): number[] {
  const contacts = contactsFrom(state, placedCell);
  const contested = new Set(contacts.filter((c) => c.contested).map((c) => c.cell));
  return remaining.filter((c) => contested.has(c));
}

function resolveUnopposed(state: MatchState, placedCell: number, events: MatchEvent[]): number[] {
  const owner = state.board[placedCell]!.occupant!.owner;
  const contacts = contactsFrom(state, placedCell);
  const contested: number[] = [];
  for (const c of contacts) {
    if (c.contested) {
      contested.push(c.cell);
      continue;
    }
    const from = state.board[c.cell]!.occupant!.owner;
    convertCell(state, c.cell, owner);
    events.push(attachEvent(state, { id: eid(), kind: 'unopposed', cell: c.cell, from, to: owner }));
  }
  return contested;
}

function tryEndTurnOrMatch(state: MatchState, rng: Rng, events: MatchEvent[]): void {
  if (state.phase === 'chooseBattleOrder') return;

  const boardFull = legalCells({ ...state, phase: 'placing' }).length === 0;
  const tenPlaced = state.placementsDone >= 10;
  if (boardFull || tenPlaced) {
    finishMatch(state, rng, events);
    return;
  }

  state.currentPlayer = otherPlayer(state.currentPlayer);
  const nextHasCards = state.hands[state.currentPlayer].length > 0;
  const nextHasCells = legalCells({ ...state, phase: 'placing' }).length > 0;
  if (!nextHasCards || !nextHasCells) {
    finishMatch(state, rng, events);
  }
}

function finishMatch(state: MatchState, rng: Rng, events: MatchEvent[]): void {
  const score = scoreBoard(state);
  let winner: MatchState['winner'] = 'draw';
  if (score.player > score.opponent) winner = 'player';
  else if (score.opponent > score.player) winner = 'opponent';
  state.winner = winner;
  events.push(attachEvent(state, { id: eid(), kind: 'matchEnd', winner, score }));

  applyMastery(state, rng, events);
  if (state.pendingMastery.length > 0) {
    state.phase = 'masteryChoice';
  } else {
    state.phase = 'ended';
  }
}

function applyStat(card: CardInstance, stat: NumericStat): { from: Hex; to: Hex } {
  const from = card[stat];
  const to = asHex(Math.min(15, from + 1));
  card[stat] = to;
  return { from, to };
}

function applyMastery(state: MatchState, rng: Rng, events: MatchEvent[]): void {
  const winner = state.winner;
  const iso = new Date(0).toISOString();
  const pending: MatchState['pendingMastery'] = [];

  for (const id of state.playedThisMatch) {
    const card = state.cards[id];
    if (!card) continue;
    const owner = ownerOfPlayed(state, id);
    const bonus = winner === owner ? 2 : 0;
    const gained = 1 + bonus;
    card.masteryXp += gained;
    card.battleHistory = { ...card.battleHistory, placements: card.battleHistory.placements + 1 };
    card.history = [...card.history, { kind: 'match', at: iso, result: winner ?? 'draw', placements: 1 }];
    if (winner === owner) card.victories += 1;

    let leveled = false;
    const mayLevel = owner === winner;
    while (mayLevel && canLevel(card.masteryXp, card.masteryLevel)) {
      card.masteryXp -= xpToNext(card.masteryLevel);
      const nextLevel = card.masteryLevel + 1;
      card.masteryLevel = Math.min(MASTERY_CAP, nextLevel);
      leveled = true;
      const eligible = eligibleStats(card);
      if (eligible.length === 0) break;
      if (isChoiceLevel(card.masteryLevel) && owner === 'player') {
        const opts = pickTwo(rng, eligible);
        pending.push({
          instanceId: id,
          options: opts.map((stat) => ({ stat })),
        });
      } else {
        const stat = rng.pick(eligible);
        const { from, to } = applyStat(card, stat);
        card.history = [...card.history, { kind: 'stat', at: iso, stat, from, to, source: 'random' }];
        events.push(attachEvent(state, { id: eid(), kind: 'masteryStat', instanceId: id, stat, from, to }));
      }
    }

    events.push(attachEvent(state, { id: eid(), kind: 'masteryXp', instanceId: id, gained, leveled }));
  }

  state.pendingMastery = pending;
}

function ownerOfPlayed(state: MatchState, instanceId: string): PlayerId | null {
  for (const cell of state.board) {
    if (cell.occupant?.instanceId === instanceId) return cell.occupant.owner;
  }
  if (state.hands.player.includes(instanceId)) return 'player';
  if (state.hands.opponent.includes(instanceId)) return 'opponent';
  return null;
}

function pickTwo<T>(rng: Rng, items: readonly T[]): T[] {
  if (items.length === 1) return [items[0]!, items[0]!];
  const first = rng.pick(items);
  const rest = items.filter((x) => x !== first);
  const second = rest.length ? rng.pick(rest) : first;
  return [first, second];
}

function maybeEvolve(
  state: MatchState,
  rng: Rng,
  card: CardInstance,
  events: MatchEvent[],
  iso: string,
): void {
  if (card.battleClass === 'P' || card.battleClass === 'M') {
    if (rng.int(1, 64) === 1) {
      const from = card.battleClass;
      card.battleClass = 'X';
      card.history = [...card.history, { kind: 'class', at: iso, from, to: 'X' }];
      events.push(attachEvent(state, { id: eid(), kind: 'classEvolution', instanceId: card.instanceId, from, to: 'X' }));
    }
  } else if (card.battleClass === 'X') {
    if (rng.int(1, 128) === 1) {
      const from = card.battleClass;
      card.battleClass = 'A';
      card.history = [...card.history, { kind: 'class', at: iso, from, to: 'A' }];
      events.push(attachEvent(state, { id: eid(), kind: 'classEvolution', instanceId: card.instanceId, from, to: 'A' }));
    }
  }
}

export function createMatch(config: MatchConfig): MatchState {
  const rng = createRng(config.seed);
  const blocked = config.blockedCells ?? generateBlockedCells(rng);
  const firstPlayer = config.firstPlayer ?? (rng.int(0, 1) === 0 ? 'player' : 'opponent');
  const cards: Record<string, CardInstance> = {};
  for (const c of [...config.playerCards, ...config.opponentCards]) {
    cards[c.instanceId] = cloneCard(c);
  }

  const state: MatchState = {
    matchId: config.matchId ?? `m-${config.seed}`,
    version: 0,
    seed: config.seed,
    rngState: rng.getState(),
    rulesVersion: RULES_VERSION,
    contentVersion: config.contentVersion ?? '1.0.0',
    board: applyBlocks(emptyBoard(), blocked),
    cards,
    hands: {
      player: config.playerCards.map((c) => c.instanceId),
      opponent: config.opponentCards.map((c) => c.instanceId),
    },
    currentPlayer: firstPlayer,
    firstPlayer,
    placementsDone: 0,
    phase: 'placing',
    pendingBattle: null,
    pendingMastery: [],
    winner: null,
    stakes: config.stakes ?? 'safe',
    playedThisMatch: [],
    eventLog: [],
  };

  attachEvent(state, {
    id: eid(),
    kind: 'matchStart',
    firstPlayer,
    blocked,
    seed: config.seed,
  });
  state.rngState = rng.getState();
  return state;
}

/** End a placing match that can no longer continue (full board, 10 cards, or no legal play). */
export function concludeIfOver(state: MatchState): ReduceResult {
  const next = cloneState(state);
  if (next.phase !== 'placing') return { nextState: next, events: [] };
  const rng = rngFromState(next.rngState);
  const events: MatchEvent[] = [];
  const open = legalCells({ ...next, phase: 'placing' }).length;
  const mine = next.hands[next.currentPlayer].length;
  const theirs = next.hands[otherPlayer(next.currentPlayer)].length;
  if (next.placementsDone >= 10 || open === 0 || (mine === 0 && theirs === 0)) {
    finishMatch(next, rng, events);
  } else if (mine === 0) {
    next.currentPlayer = otherPlayer(next.currentPlayer);
    if (next.hands[next.currentPlayer].length === 0 || open === 0) {
      finishMatch(next, rng, events);
    }
  }
  next.rngState = rng.getState();
  next.version = state.version + 1;
  return { nextState: next, events };
}

function illegal(state: MatchState, reason: string): ReduceResult {
  const events: MatchEvent[] = [{ id: eid(), kind: 'illegal', reason }];
  return { nextState: state, events };
}

export function reduce(state: MatchState, action: GameAction): ReduceResult {
  const next = cloneState(state);
  const rng = rngFromState(next.rngState);
  const events: MatchEvent[] = [];

  if (action.type === 'place') {
    if (next.phase !== 'placing') return illegal(state, 'not placing');
    if (!next.hands[next.currentPlayer].includes(action.instanceId)) {
      return illegal(state, 'card not in hand');
    }
    const cell = next.board[action.cell];
    if (!cell || cell.blocked || cell.occupant) return illegal(state, 'illegal cell');

    next.board[action.cell] = {
      blocked: false,
      occupant: { instanceId: action.instanceId, owner: next.currentPlayer },
    };
    next.hands[next.currentPlayer] = next.hands[next.currentPlayer].filter((id) => id !== action.instanceId);
    next.placementsDone += 1;
    if (!next.playedThisMatch.includes(action.instanceId)) {
      next.playedThisMatch = [...next.playedThisMatch, action.instanceId];
    }
    events.push(
      attachEvent(next, {
        id: eid(),
        kind: 'place',
        player: next.currentPlayer,
        instanceId: action.instanceId,
        cell: action.cell,
      }),
    );

    const contested = resolveUnopposed(next, action.cell, events);
    if (contested.length > 1) {
      next.phase = 'chooseBattleOrder';
      next.pendingBattle = { placedCell: action.cell, contestedCells: contested };
    } else if (contested.length === 1) {
      fight(next, rng, action.cell, contested[0]!, events);
      next.phase = 'placing';
      next.pendingBattle = null;
      tryEndTurnOrMatch(next, rng, events);
    } else {
      next.phase = 'placing';
      tryEndTurnOrMatch(next, rng, events);
    }
  } else if (action.type === 'chooseBattleOrder') {
    if (next.phase !== 'chooseBattleOrder' || !next.pendingBattle) {
      return illegal(state, 'no pending battles');
    }
    const pending = next.pendingBattle;
    const set = new Set(pending.contestedCells);
    if (action.order.length !== pending.contestedCells.length || action.order.some((c) => !set.has(c))) {
      return illegal(state, 'invalid battle order');
    }
    events.push(attachEvent(next, { id: eid(), kind: 'battleOrder', order: action.order }));
    const placer = next.board[pending.placedCell]?.occupant?.owner;
    for (const target of action.order) {
      if (next.board[pending.placedCell]?.occupant?.owner !== placer) break;
      const live = remainingContested(next, pending.placedCell, [target]);
      if (live.length === 0) continue;
      fight(next, rng, pending.placedCell, target, events);
    }
    next.pendingBattle = null;
    next.phase = 'placing';
    tryEndTurnOrMatch(next, rng, events);
  } else if (action.type === 'chooseMasteryUpgrade') {
    if (next.phase !== 'masteryChoice') return illegal(state, 'no mastery choice');
    const idx = next.pendingMastery.findIndex((p) => p.instanceId === action.instanceId);
    if (idx < 0) return illegal(state, 'unknown mastery card');
    const choice = next.pendingMastery[idx]!;
    const opt = choice.options[action.optionIndex];
    if (!opt) return illegal(state, 'bad option');
    const card = next.cards[action.instanceId];
    if (!card) return illegal(state, 'missing card');
    const { from, to } = applyStat(card, opt.stat);
    card.history = [
      ...card.history,
      { kind: 'stat', at: new Date(0).toISOString(), stat: opt.stat, from, to, source: 'choice' },
    ];
    events.push(
      attachEvent(next, { id: eid(), kind: 'masteryStat', instanceId: card.instanceId, stat: opt.stat, from, to }),
    );
    next.pendingMastery = next.pendingMastery.filter((_, i) => i !== idx);
    if (next.pendingMastery.length === 0) next.phase = 'ended';
  }

  next.rngState = rng.getState();
  next.version = state.version + 1;
  return { nextState: next, events };
}

export function applyActions(state: MatchState, actions: GameAction[]): MatchState {
  let cur = state;
  for (const a of actions) {
    const { nextState, events } = reduce(cur, a);
    if (events.some((e) => e.kind === 'illegal')) {
      throw new Error(
        `illegal action ${JSON.stringify(a)}: ${(events.find((e) => e.kind === 'illegal') as { reason: string }).reason}`,
      );
    }
    cur = nextState;
  }
  return cur;
}
