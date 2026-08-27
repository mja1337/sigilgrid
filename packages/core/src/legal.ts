import { hasArrow, neighbor, OPPOSITE } from './directions.ts';
import type { CardInstance, Direction, MatchState, PlayerId } from './types.ts';

export function otherPlayer(p: PlayerId): PlayerId {
  return p === 'player' ? 'opponent' : 'player';
}

export function cardAt(state: MatchState, cell: number): CardInstance | null {
  const occ = state.board[cell]?.occupant;
  if (!occ) return null;
  return state.cards[occ.instanceId] ?? null;
}

export function legalCells(state: MatchState): number[] {
  if (state.phase !== 'placing') return [];
  return state.board
    .map((c, i) => (c.blocked || c.occupant ? -1 : i))
    .filter((i) => i >= 0);
}

export function legalHand(state: MatchState): string[] {
  if (state.phase !== 'placing') return [];
  return state.hands[state.currentPlayer];
}

export type ArrowContact = {
  dir: Direction;
  cell: number;
  contested: boolean;
};

export function contactsFrom(state: MatchState, placedCell: number): ArrowContact[] {
  const placedOcc = state.board[placedCell]?.occupant;
  if (!placedOcc) return [];
  const placed = state.cards[placedOcc.instanceId];
  if (!placed) return [];
  const owner = placedOcc.owner;
  const out: ArrowContact[] = [];
  for (const dir of placed.arrows) {
    const n = neighbor(placedCell, dir);
    if (n === null) continue;
    const occ = state.board[n]?.occupant;
    if (!occ || occ.owner === owner) continue;
    const enemy = state.cards[occ.instanceId];
    if (!enemy) continue;
    const back = OPPOSITE[dir];
    const contested = hasArrow(enemy.arrows, back);
    out.push({ dir, cell: n, contested });
  }
  return out;
}

export function scoreBoard(state: MatchState): { player: number; opponent: number } {
  let player = 0;
  let opponent = 0;
  for (const cell of state.board) {
    if (!cell.occupant) continue;
    if (cell.occupant.owner === 'player') player++;
    else opponent++;
  }
  return { player, opponent };
}

export function noLegalPlacement(state: MatchState): boolean {
  return legalCells({ ...state, phase: 'placing' }).length === 0;
}
