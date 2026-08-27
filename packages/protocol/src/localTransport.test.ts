import { describe, expect, it } from 'vitest';
import { makeCard } from '@sigilgrid/core';
import { LocalMatchTransport } from './localTransport.ts';

function deck(prefix: string) {
  return Array.from({ length: 5 }, (_, i) =>
    makeCard({ instanceId: `${prefix}-${i}`, arrows: ['N'], attack: 5, physicalDefense: 5, magicalDefense: 5 }),
  );
}

describe('LocalMatchTransport', () => {
  it('creates and applies a placement', async () => {
    const t = new LocalMatchTransport();
    const snap = await t.createMatch({
      seed: 1,
      playerCards: deck('p'),
      opponentCards: deck('o'),
      blockedCells: [],
      firstPlayer: 'player',
    });
    const delta = await t.submitAction(snap.state.matchId, { type: 'place', instanceId: 'p-0', cell: 0 }, 0);
    expect(delta.toVersion).toBe(1);
    expect(delta.state.board[0]?.occupant?.instanceId).toBe('p-0');
    const again = await t.reconnect(snap.state.matchId);
    expect(again.state.version).toBe(1);
  });
});
