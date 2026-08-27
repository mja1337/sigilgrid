import type { GameAction, MatchConfig, MatchState, ReduceResult } from '@sigilgrid/core';

export const PROTOCOL_VERSION = 1;

export type MatchSnapshot = {
  protocolVersion: number;
  state: MatchState;
  /** Future: hidden hands for spectators. */
  privateHands?: never;
};

export type MatchDelta = {
  protocolVersion: number;
  matchId: string;
  fromVersion: number;
  toVersion: number;
  events: ReduceResult['events'];
  state: MatchState;
};

/**
 * Transport contract for local play now and server-authoritative multiplayer later.
 * Future hooks (unimplemented): async play, reconnect tokens, time controls,
 * spectators, matchmaking, cosmetic monetisation, anti-cheat validation.
 */
export interface MatchTransport {
  createMatch(config: MatchConfig): Promise<MatchSnapshot>;
  submitAction(matchId: string, action: GameAction, expectedVersion: number): Promise<MatchDelta>;
  subscribe(matchId: string, listener: (delta: MatchDelta) => void): () => void;
  reconnect(matchId: string, lastEventId?: string): Promise<MatchSnapshot>;
}

export type StoredReplay = {
  protocolVersion: number;
  config: MatchConfig;
  actions: GameAction[];
  createdAt: string;
};
