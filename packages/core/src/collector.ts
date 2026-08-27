import { DIRECTIONS, type BattleClass, type CardInstance, type Direction } from './types.ts';

/** Unique type 10 + unique arrow mask 5 + class (best copy: X 1 / A 2). Max 1700. */
export const COLLECTOR_MAX = 1700;

const RANKS: { max: number; title: string }[] = [
  { max: 299, title: 'Beginner' },
  { max: 399, title: 'Novice' },
  { max: 499, title: 'Player' },
  { max: 599, title: 'Senior' },
  { max: 699, title: 'Fan' },
  { max: 799, title: 'Leader' },
  { max: 899, title: 'Coach' },
  { max: 999, title: 'Advisor' },
  { max: 1099, title: 'Director' },
  { max: 1199, title: 'Dealer' },
  { max: 1249, title: 'Trader' },
  { max: 1299, title: 'Commander' },
  { max: 1319, title: 'Doctor' },
  { max: 1329, title: 'Professor' },
  { max: 1339, title: 'Veteran' },
  { max: 1349, title: 'Freak' },
  { max: 1359, title: 'Champion' },
  { max: 1369, title: 'Analyst' },
  { max: 1379, title: 'General' },
  { max: 1389, title: 'Expert' },
  { max: 1399, title: 'Shark' },
  { max: 1419, title: 'Specialist' },
  { max: 1469, title: 'Elder' },
  { max: 1499, title: 'Dominator' },
  { max: 1549, title: 'Maestro' },
  { max: 1599, title: 'King' },
  { max: 1649, title: 'Wizard' },
  { max: 1679, title: 'Authority' },
  { max: 1689, title: 'Emperor' },
  { max: 1697, title: 'Pro' },
  { max: 1699, title: 'Master' },
  { max: COLLECTOR_MAX, title: 'The Collector' },
];

export function arrowMask(arrows: readonly Direction[]): number {
  let mask = 0;
  for (const d of arrows) {
    const i = DIRECTIONS.indexOf(d);
    if (i >= 0) mask |= 1 << i;
  }
  return mask;
}

export function collectorTitle(points: number): string {
  const n = Math.max(0, Math.min(COLLECTOR_MAX, Math.floor(points)));
  return RANKS.find((r) => n <= r.max)?.title ?? 'The Collector';
}

export type CollectorBreakdown = {
  points: number;
  title: string;
  uniqueTypes: number;
  uniqueArrows: number;
  classX: number;
  classA: number;
  typePoints: number;
  arrowPoints: number;
  classPoints: number;
};

const CLASS_RANK: Record<BattleClass, number> = { P: 0, M: 0, X: 1, A: 2 };

export function collectorScore(cards: readonly CardInstance[]): CollectorBreakdown {
  const types = new Set<string>();
  const arrows = new Set<number>();
  const bestClass = new Map<string, BattleClass>();

  for (const card of cards) {
    types.add(card.templateId);
    arrows.add(arrowMask(card.arrows));
    const prev = bestClass.get(card.templateId);
    if (!prev || CLASS_RANK[card.battleClass] > CLASS_RANK[prev]) {
      bestClass.set(card.templateId, card.battleClass);
    }
  }

  let classX = 0;
  let classA = 0;
  for (const cls of bestClass.values()) {
    if (cls === 'X') classX += 1;
    if (cls === 'A') classA += 1;
  }

  const typePoints = types.size * 10;
  const arrowPoints = arrows.size * 5;
  const classPoints = classX * 1 + classA * 2;
  const points = Math.min(COLLECTOR_MAX, typePoints + arrowPoints + classPoints);

  return {
    points,
    title: collectorTitle(points),
    uniqueTypes: types.size,
    uniqueArrows: arrows.size,
    classX,
    classA,
    typePoints,
    arrowPoints,
    classPoints,
  };
}

export function cardCollectorShare(
  card: CardInstance,
  cards: readonly CardInstance[],
): { type: number; arrows: number; cls: number; total: number } {
  const typeFirst = cards.find((c) => c.templateId === card.templateId);
  const type = typeFirst?.instanceId === card.instanceId ? 10 : 0;

  const mask = arrowMask(card.arrows);
  const arrowFirst = cards.find((c) => arrowMask(c.arrows) === mask);
  const arrows = arrowFirst?.instanceId === card.instanceId ? 5 : 0;

  const best = cards
    .filter((c) => c.templateId === card.templateId)
    .reduce<CardInstance | null>((acc, c) => {
      if (!acc || CLASS_RANK[c.battleClass] > CLASS_RANK[acc.battleClass]) return c;
      return acc;
    }, null);
  const cls =
    best?.instanceId === card.instanceId
      ? card.battleClass === 'A'
        ? 2
        : card.battleClass === 'X'
          ? 1
          : 0
      : 0;

  return { type, arrows, cls, total: type + arrows + cls };
}
