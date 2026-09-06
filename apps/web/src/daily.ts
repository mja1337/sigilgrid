import type { PlayerId } from '@sigilgrid/core';

export type DailyChallenge = {
  date: string;
  seed: number;
  name: string;
  description: string;
  blockedCells: number[];
  firstPlayer?: PlayerId;
  ai: 'standard' | 'expert';
  opponentTemplates: string[];
};

const DAILY_OPPONENTS = [
  ['lizardman', 'zombie', 'bomb', 'ironite', 'sahagin'],
  ['yeti', 'mimic', 'wyerd', 'mandragora', 'crawler'],
  ['nymph', 'sand-golem', 'zuu', 'dragonfly', 'carrion-worm'],
] as const;

const MODIFIERS = [
  {
    name: 'First Light',
    description: 'You take the opening move on a four-stone cross.',
    blockedCells: [5, 6, 9, 10],
    firstPlayer: 'player' as const,
    ai: 'standard' as const,
  },
  {
    name: 'Countermarch',
    description: 'The opponent moves first and reads the board at expert strength.',
    blockedCells: [3, 12],
    firstPlayer: 'opponent' as const,
    ai: 'expert' as const,
  },
  {
    name: 'Ash-Choked Grid',
    description: 'Six closed spaces leave narrow lanes and expensive corners.',
    blockedCells: [1, 4, 6, 9, 11, 14],
    ai: 'standard' as const,
  },
  {
    name: 'Open Sky',
    description: 'No stones. Every edge is exposed against an expert opponent.',
    blockedCells: [],
    ai: 'expert' as const,
  },
  {
    name: 'Broken Compass',
    description: 'A diagonal fault splits the grid; the coin still decides first place.',
    blockedCells: [0, 5, 10, 15],
    ai: 'standard' as const,
  },
] as const;

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dailySeed(date: string): number {
  const parsed = Number(date.replaceAll('-', ''));
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  let hash = 2166136261;
  for (const char of date) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function dailyChallenge(date = todayKey()): DailyChallenge {
  const seed = dailySeed(date);
  const modifier = MODIFIERS[seed % MODIFIERS.length]!;
  const opponentTemplates = DAILY_OPPONENTS[Math.floor(seed / MODIFIERS.length) % DAILY_OPPONENTS.length]!;
  return {
    date,
    seed,
    ...modifier,
    blockedCells: [...modifier.blockedCells],
    opponentTemplates: [...opponentTemplates],
  };
}

export function isPreviousDay(previous: string, current: string): boolean {
  const from = Date.parse(`${previous}T00:00:00Z`);
  const to = Date.parse(`${current}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) && to - from === 86_400_000;
}

export function visibleDailyStreak(
  daily: { streak?: number; lastWinDate?: string },
  date = todayKey(),
): number {
  if (!daily.lastWinDate) return 0;
  if (daily.lastWinDate === date || isPreviousDay(daily.lastWinDate, date)) return daily.streak ?? 0;
  return 0;
}
