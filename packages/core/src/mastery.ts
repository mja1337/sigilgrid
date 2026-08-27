import type { Hex } from './types.ts';

export function xpToNext(masteryLevel: number): number {
  return 3 + masteryLevel * 2;
}

export const MASTERY_CAP = 12;

export function canLevel(xp: number, level: number): boolean {
  if (level >= MASTERY_CAP) return false;
  return xp >= xpToNext(level);
}

export function isChoiceLevel(nextLevel: number): boolean {
  return nextLevel > 0 && nextLevel % 3 === 0;
}

export const STAT_KEYS = ['attack', 'physicalDefense', 'magicalDefense'] as const;

export function eligibleStats(card: {
  attack: Hex;
  physicalDefense: Hex;
  magicalDefense: Hex;
}): (typeof STAT_KEYS)[number][] {
  return STAT_KEYS.filter((k) => card[k] < 15);
}
