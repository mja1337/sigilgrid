import type { CardInstance, Hex, MatchState } from './types.ts';

export function cloneCard(card: CardInstance): CardInstance {
  return {
    ...card,
    arrows: [...card.arrows],
    battleHistory: { ...card.battleHistory },
    history: card.history.map((h) => ({ ...h })),
  };
}

export function cloneState(state: MatchState): MatchState {
  const cards: Record<string, CardInstance> = {};
  for (const [k, v] of Object.entries(state.cards)) cards[k] = cloneCard(v);
  return {
    ...state,
    board: state.board.map((c) => ({
      blocked: c.blocked,
      occupant: c.occupant ? { ...c.occupant } : null,
    })),
    cards,
    hands: {
      player: [...state.hands.player],
      opponent: [...state.hands.opponent],
    },
    pendingBattle: state.pendingBattle
      ? {
          placedCell: state.pendingBattle.placedCell,
          contestedCells: [...state.pendingBattle.contestedCells],
        }
      : null,
    pendingMastery: state.pendingMastery.map((m) => ({
      instanceId: m.instanceId,
      options: m.options.map((o) => ({ ...o })),
    })),
    playedThisMatch: [...state.playedThisMatch],
    eventLog: [...state.eventLog],
    winner: state.winner,
  };
}

export function bumpHex(h: Hex): Hex {
  return Math.min(15, h + 1) as Hex;
}
