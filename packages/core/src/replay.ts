import { applyActions, createMatch } from './match.ts';
import type { GameAction, MatchConfig, MatchState } from './types.ts';

export type ReplayRecord = {
  config: MatchConfig;
  actions: GameAction[];
  rulesVersion: string;
  contentVersion: string;
};

export function replayMatch(record: ReplayRecord): MatchState {
  const start = createMatch(record.config);
  return applyActions(start, record.actions);
}

export function boardSignature(state: MatchState): string {
  return state.board
    .map((c) => {
      if (c.blocked) return '#';
      if (!c.occupant) return '.';
      return `${c.occupant.owner[0]}:${c.occupant.instanceId}`;
    })
    .join('|');
}
