export const RULES_VERSION = '1.0.0';

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type BattleClass = 'P' | 'M' | 'X' | 'A';
export type Hex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type Rarity = 'common' | 'uncommon' | 'rare' | 'relic';
export type Provenance = 'starter' | 'reward' | 'drop' | 'trade' | 'event';
export type PlayerId = 'player' | 'opponent';
export type MatchResult = PlayerId | 'draw';
export type Stakes = 'safe' | 'wager';
export type NumericStat = 'attack' | 'physicalDefense' | 'magicalDefense';

export const DIRECTIONS: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type CardInstance = {
  instanceId: string;
  templateId: string;
  displayName: string;
  rarity: Rarity;
  arrows: Direction[];
  attack: Hex;
  battleClass: BattleClass;
  physicalDefense: Hex;
  magicalDefense: Hex;
  /** 0–15 remainder toward the next displayed Attack pip (Tetra Master hidden stat). */
  attackFine: number;
  physicalFine: number;
  magicalFine: number;
  masteryXp: number;
  masteryLevel: number;
  victories: number;
  battleHistory: { wins: number; losses: number; placements: number };
  provenance: Provenance;
  history: CardHistoryEntry[];
};

export type CardHistoryEntry =
  | { kind: 'created'; at: string; note: string }
  | { kind: 'stat'; at: string; stat: NumericStat; from: Hex; to: Hex; source: 'random' | 'choice' }
  | { kind: 'class'; at: string; from: BattleClass; to: BattleClass }
  | { kind: 'match'; at: string; result: MatchResult; placements: number };

export type CellState = {
  blocked: boolean;
  occupant: { instanceId: string; owner: PlayerId } | null;
};

export type MatchPhase = 'placing' | 'chooseBattleOrder' | 'masteryChoice' | 'ended';

export type MatchConfig = {
  seed: number;
  playerCards: CardInstance[];
  opponentCards: CardInstance[];
  blockedCells?: number[];
  firstPlayer?: PlayerId;
  stakes?: Stakes;
  contentVersion?: string;
  /** Optional match id; generated if omitted. */
  matchId?: string;
};

export type PendingBattle = {
  placedCell: number;
  contestedCells: number[];
};

export type MasteryChoice = {
  instanceId: string;
  options: { stat: NumericStat }[];
};

export type MatchState = {
  matchId: string;
  version: number;
  seed: number;
  rngState: number;
  rulesVersion: string;
  contentVersion: string;
  board: CellState[];
  cards: Record<string, CardInstance>;
  hands: Record<PlayerId, string[]>;
  currentPlayer: PlayerId;
  firstPlayer: PlayerId;
  placementsDone: number;
  phase: MatchPhase;
  pendingBattle: PendingBattle | null;
  pendingMastery: MasteryChoice[];
  winner: MatchResult | null;
  stakes: Stakes;
  playedThisMatch: string[];
  eventLog: MatchEvent[];
};

export type GameAction =
  | { type: 'place'; instanceId: string; cell: number }
  | { type: 'chooseBattleOrder'; order: number[] }
  | { type: 'chooseMasteryUpgrade'; instanceId: string; optionIndex: 0 | 1 };

export type MatchEvent =
  | { id: string; kind: 'matchStart'; firstPlayer: PlayerId; blocked: number[]; seed: number }
  | { id: string; kind: 'place'; player: PlayerId; instanceId: string; cell: number }
  | { id: string; kind: 'unopposed'; cell: number; from: PlayerId; to: PlayerId }
  | {
      id: string;
      kind: 'battle';
      placedCell: number;
      targetCell: number;
      attackerId: string;
      defenderId: string;
      detail: BattleDetail;
      winner: PlayerId;
    }
  | { id: string; kind: 'combo'; fromCell: number; convertedCells: number[]; to: PlayerId }
  | { id: string; kind: 'battleOrder'; order: number[] }
  | { id: string; kind: 'matchEnd'; winner: MatchResult; score: { player: number; opponent: number } }
  | { id: string; kind: 'masteryXp'; instanceId: string; gained: number; leveled: boolean }
  | { id: string; kind: 'masteryStat'; instanceId: string; stat: NumericStat; from: Hex; to: Hex }
  | { id: string; kind: 'classEvolution'; instanceId: string; from: BattleClass; to: BattleClass }
  | { id: string; kind: 'illegal'; reason: string };

export type BattleDetail = {
  attackerClass: BattleClass;
  attackBand: [number, number];
  defenseBand: [number, number];
  attackBase: number;
  defenseBase: number;
  attackExertion: number;
  defenseExertion: number;
  attackFinal: number;
  defenseFinal: number;
  attackerAttr?: NumericStat | 'mixed';
  defenderAttr?: NumericStat | 'mixed';
};

export type ReduceResult = {
  nextState: MatchState;
  events: MatchEvent[];
};

export type PlacementPreview = {
  cell: number;
  instanceId: string;
  unopposed: number[];
  contested: number[];
  chances: { cell: number; low: number; high: number }[];
};

export type AiPersonality = {
  aggression: number;
  classBias: Partial<Record<BattleClass, number>>;
  riskTolerance: number;
};
