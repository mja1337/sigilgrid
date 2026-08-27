import { chanceBand, estimateWinChance } from './battle.ts';
import { cloneState } from './clone.ts';
import { contactsFrom } from './legal.ts';
import type { MatchState, PlacementPreview } from './types.ts';

export function previewPlacement(state: MatchState, instanceId: string, cell: number): PlacementPreview | null {
  if (state.phase !== 'placing') return null;
  const boardCell = state.board[cell];
  if (!boardCell || boardCell.blocked || boardCell.occupant) return null;
  if (!state.hands[state.currentPlayer].includes(instanceId)) return null;

  const sim = cloneState(state);
  sim.board[cell] = {
    blocked: false,
    occupant: { instanceId, owner: sim.currentPlayer },
  };
  const contacts = contactsFrom(sim, cell);
  const unopposed = contacts.filter((c) => !c.contested).map((c) => c.cell);
  const contested = contacts.filter((c) => c.contested).map((c) => c.cell);
  const placed = sim.cards[instanceId];
  const chances = contested.map((c) => {
    const occ = sim.board[c]!.occupant!;
    const def = sim.cards[occ.instanceId]!;
    const p = estimateWinChance(state.rngState ^ (cell * 17 + c), placed, def);
    return { cell: c, ...chanceBand(p) };
  });
  return { cell, instanceId, unopposed, contested, chances };
}
