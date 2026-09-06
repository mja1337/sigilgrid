import { describe, expect, it } from 'vitest';
import { instantiateId } from '@sigilgrid/content';
import type { StoredReplay } from '@sigilgrid/protocol';
import { replayStates } from './screens/Replay.tsx';

describe('replay theatre', () => {
  it('reconstructs every action from the stored starting hands', () => {
    const player = instantiateId('goblin', 1, 'starter', 'p-goblin');
    const opponent = instantiateId('fang', 2, 'event', 'o-fang');
    const record: StoredReplay = {
      protocolVersion: 1,
      config: {
        seed: 10,
        playerCards: [player],
        opponentCards: [opponent],
        blockedCells: Array.from({ length: 14 }, (_, index) => index + 2),
        firstPlayer: 'player',
      },
      actions: [
        { type: 'place', instanceId: player.instanceId, cell: 0 },
        { type: 'place', instanceId: opponent.instanceId, cell: 1 },
      ],
      createdAt: '2026-09-06T00:00:00.000Z',
    };

    const states = replayStates(record);
    expect(states).toHaveLength(3);
    expect(states[2]?.phase).toBe('ended');
    expect(states[2]?.board[0].occupant?.instanceId).toBe(player.instanceId);
    expect(states[2]?.board[1].occupant?.instanceId).toBe(opponent.instanceId);
  });
});
