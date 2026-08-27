import { createMatch, reduce, type GameAction, type MatchConfig, type MatchState } from '@sigilgrid/core';
import { PROTOCOL_VERSION, type MatchDelta, type MatchSnapshot, type MatchTransport } from './types.ts';

type Room = {
  state: MatchState;
  actions: GameAction[];
  listeners: Set<(delta: MatchDelta) => void>;
};

export class LocalMatchTransport implements MatchTransport {
  private rooms = new Map<string, Room>();

  async createMatch(config: MatchConfig): Promise<MatchSnapshot> {
    const state = createMatch(config);
    this.rooms.set(state.matchId, { state, actions: [], listeners: new Set() });
    return { protocolVersion: PROTOCOL_VERSION, state };
  }

  async submitAction(matchId: string, action: GameAction, expectedVersion: number): Promise<MatchDelta> {
    const room = this.rooms.get(matchId);
    if (!room) throw new Error(`unknown match ${matchId}`);
    if (room.state.version !== expectedVersion) {
      throw new Error(`version mismatch: have ${room.state.version} expected ${expectedVersion}`);
    }
    const { nextState, events } = reduce(room.state, action);
    if (events.some((e) => e.kind === 'illegal')) {
      throw new Error(events.find((e) => e.kind === 'illegal' && e.kind === 'illegal') ? (events.find((e) => e.kind === 'illegal') as { reason: string }).reason : 'illegal');
    }
    const fromVersion = room.state.version;
    room.state = nextState;
    room.actions.push(action);
    const delta: MatchDelta = {
      protocolVersion: PROTOCOL_VERSION,
      matchId,
      fromVersion,
      toVersion: nextState.version,
      events,
      state: nextState,
    };
    for (const l of room.listeners) l(delta);
    return delta;
  }

  subscribe(matchId: string, listener: (delta: MatchDelta) => void): () => void {
    const room = this.rooms.get(matchId);
    if (!room) throw new Error(`unknown match ${matchId}`);
    room.listeners.add(listener);
    return () => room.listeners.delete(listener);
  }

  async reconnect(matchId: string, _lastEventId?: string): Promise<MatchSnapshot> {
    const room = this.rooms.get(matchId);
    if (!room) throw new Error(`unknown match ${matchId}`);
    return { protocolVersion: PROTOCOL_VERSION, state: room.state };
  }

  getActions(matchId: string): GameAction[] {
    return this.rooms.get(matchId)?.actions ?? [];
  }

  getState(matchId: string): MatchState | undefined {
    return this.rooms.get(matchId)?.state;
  }
}
