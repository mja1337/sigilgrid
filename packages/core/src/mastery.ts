import type { CardInstance, Hex, NumericStat } from './types.ts';
import { asHex } from './hex.ts';

export const HIDDEN_PER_PIP = 16;
export const HIDDEN_PER_WIN = 4;
export const MASTERY_CAP = 12;

export const STAT_KEYS = ['attack', 'physicalDefense', 'magicalDefense'] as const;

const FINE: Record<NumericStat, 'attackFine' | 'physicalFine' | 'magicalFine'> = {
  attack: 'attackFine',
  physicalDefense: 'physicalFine',
  magicalDefense: 'magicalFine',
};

export function xpToNext(_masteryLevel = 0): number {
  return HIDDEN_PER_PIP;
}

export function canLevel(xp: number, level: number): boolean {
  if (level >= MASTERY_CAP) return false;
  return xp >= xpToNext(level);
}

export function isChoiceLevel(nextLevel: number): boolean {
  return nextLevel > 0 && nextLevel % 3 === 0;
}

export function eligibleStats(card: {
  attack: Hex;
  physicalDefense: Hex;
  magicalDefense: Hex;
}): (typeof STAT_KEYS)[number][] {
  return STAT_KEYS.filter((k) => card[k] < 15);
}

export function hiddenTotal(displayed: Hex, fine = 0): number {
  return displayed * HIDDEN_PER_PIP + clampFine(fine);
}

export function splitHidden(total: number): { hex: Hex; fine: number } {
  const clamped = Math.max(0, Math.min(255, Math.floor(total)));
  return { hex: asHex(Math.floor(clamped / HIDDEN_PER_PIP)), fine: clamped % HIDDEN_PER_PIP };
}

export function hiddenOf(card: CardInstance, stat: NumericStat): number {
  return hiddenTotal(card[stat], card[FINE[stat]] ?? 0);
}

export function remainingToPip(card: CardInstance, stat: NumericStat): number {
  if (card[stat] >= 15) return 0;
  return HIDDEN_PER_PIP - clampFine(card[FINE[stat]] ?? 0);
}

export function winsToPip(card: CardInstance, stat: NumericStat): number {
  const rem = remainingToPip(card, stat);
  if (rem <= 0) return 0;
  return Math.ceil(rem / HIDDEN_PER_WIN);
}

export function nearestUpgrade(card: CardInstance): {
  stat: NumericStat;
  remaining: number;
  winsIfChosen: number;
  expectedWins: number;
} | null {
  const eligible = eligibleStats(card);
  if (eligible.length === 0) return null;
  let best = eligible[0]!;
  let rem = remainingToPip(card, best);
  for (const stat of eligible) {
    const r = remainingToPip(card, stat);
    if (r < rem) {
      best = stat;
      rem = r;
    }
  }
  const winsIfChosen = Math.ceil(rem / HIDDEN_PER_WIN);
  return {
    stat: best,
    remaining: rem,
    winsIfChosen,
    expectedWins: winsIfChosen * eligible.length,
  };
}

export function addHidden(
  card: CardInstance,
  stat: NumericStat,
  amount: number,
): { from: Hex; to: Hex; pipUp: boolean } {
  const from = card[stat];
  const next = splitHidden(hiddenOf(card, stat) + amount);
  card[stat] = next.hex;
  card[FINE[stat]] = next.fine;
  const pipUp = next.hex > from;
  if (pipUp) card.masteryLevel = Math.min(MASTERY_CAP, card.masteryLevel + (next.hex - from));
  card.masteryXp = nearestUpgrade(card)?.remaining ?? 0;
  return { from, to: next.hex, pipUp };
}

export function applyDisplayedPip(card: CardInstance, stat: NumericStat): { from: Hex; to: Hex } {
  return addHidden(card, stat, HIDDEN_PER_PIP);
}

export const STAT_LABEL: Record<NumericStat, string> = {
  attack: 'Attack',
  physicalDefense: 'Physical defense',
  magicalDefense: 'Magical defense',
};

export function cardPower(card: CardInstance): number {
  const cls = card.battleClass === 'A' ? 48 : card.battleClass === 'X' ? 24 : 0;
  return (
    hiddenOf(card, 'attack') +
    hiddenOf(card, 'physicalDefense') +
    hiddenOf(card, 'magicalDefense') +
    cls +
    card.arrows.length * 8
  );
}

export function powerBand(power: number): string {
  if (power < 40) return 'Fledgling';
  if (power < 90) return 'Growing';
  if (power < 160) return 'Seasoned';
  if (power < 240) return 'Formidable';
  return 'Peak';
}

function clampFine(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(15, Math.floor(n)));
}
