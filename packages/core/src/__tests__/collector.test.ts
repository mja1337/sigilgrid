import { describe, expect, it } from 'vitest';
import { arrowMask, collectorScore, collectorTitle, COLLECTOR_MAX, discardImpact } from '../collector.ts';
import { makeCard } from '../factory.ts';
import { addHidden, hiddenOf, HIDDEN_PER_WIN, nearestUpgrade, remainingToPip } from '../mastery.ts';
import type { BattleClass, Direction } from '../types.ts';

describe('collector points', () => {
  it('scores unique types, unique arrows, and best class per type', () => {
    const goblin = makeCard({
      instanceId: 'g1',
      templateId: 'goblin',
      arrows: ['N'],
      battleClass: 'P',
    });
    const goblinDup = makeCard({
      instanceId: 'g2',
      templateId: 'goblin',
      arrows: ['N'],
      battleClass: 'A',
    });
    const fang = makeCard({
      instanceId: 'f1',
      templateId: 'fang',
      arrows: ['E', 'W'],
      battleClass: 'X',
    });
    const score = collectorScore([goblin, goblinDup, fang]);
    expect(score.uniqueTypes).toBe(2);
    expect(score.typePoints).toBe(20);
    expect(score.uniqueArrows).toBe(2);
    expect(score.arrowPoints).toBe(10);
    expect(score.classA).toBe(1);
    expect(score.classX).toBe(1);
    expect(score.classPoints).toBe(3);
    expect(score.points).toBe(33);
    expect(score.title).toBe('Beginner');
  });

  it('caps at 1700 The Collector', () => {
    const dirs = Array.from({ length: 100 }, (_, i) => {
      const mask = i + 1;
      const arrows: Direction[] = [];
      (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const).forEach((d, b) => {
        if (mask & (1 << b)) arrows.push(d);
      });
      return arrows;
    });
    const cards = dirs.map((arrows, i) =>
      makeCard({
        instanceId: `c${i}`,
        templateId: `t${i}`,
        arrows,
        battleClass: 'A',
      }),
    );
    const score = collectorScore(cards);
    expect(score.uniqueTypes).toBe(100);
    expect(score.uniqueArrows).toBe(100);
    expect(score.classA).toBe(100);
    expect(score.points).toBe(COLLECTOR_MAX);
    expect(score.title).toBe('The Collector');
    expect(collectorTitle(0)).toBe('Beginner');
    expect(collectorTitle(1000)).toBe('Director');
    expect(collectorTitle(1698)).toBe('Master');
    expect(arrowMask(['N', 'S'])).not.toBe(arrowMask(['E', 'W']));
  });
});

describe('hidden stats', () => {
  it('fills 16 hidden points into the next displayed pip', () => {
    const card = makeCard({ arrows: ['N'], attack: 0, physicalDefense: 0, magicalDefense: 0 });
    const first = addHidden(card, 'attack', HIDDEN_PER_WIN);
    expect(first.to).toBe(0);
    expect(first.pipUp).toBe(false);
    expect(hiddenOf(card, 'attack')).toBe(4);
    expect(remainingToPip(card, 'attack')).toBe(12);
    const pip = addHidden(card, 'attack', 12);
    expect(pip.to).toBe(1);
    expect(pip.pipUp).toBe(true);
    expect(card.attack).toBe(1);
    expect(card.attackFine).toBe(0);
    expect(nearestUpgrade(card)?.stat).toBeTruthy();
  });
});

describe('discardImpact', () => {
  const card = (
    instanceId: string,
    templateId: string,
    arrows: Direction[],
    battleClass: BattleClass = 'P',
  ) => makeCard({ instanceId, templateId, displayName: templateId, arrows, battleClass });

  it('charges 10 for the last copy of a type', () => {
    const a = card('a', 'goblin', ['N']);
    const b = card('b', 'fang', ['E']);
    const impact = discardImpact(a, [a, b]);
    expect(impact.losesType).toBe(true);
    expect(impact.points).toBe(15); // 10 type + 5 arrows
  });

  it('charges nothing when a duplicate still covers both properties', () => {
    const a = card('a', 'goblin', ['N']);
    const dup = card('b', 'goblin', ['N']);
    const impact = discardImpact(a, [a, dup]);
    expect(impact.points).toBe(0);
    expect(impact.losesType).toBe(false);
    expect(impact.losesArrows).toBe(false);
  });

  // The trap the old per-card attribution fell into: with two cards sharing a
  // mask it credited only the first, so discarding it looked like a 5-point
  // loss even though the second still covers the pattern.
  it('does not charge for an arrow pattern another card still has', () => {
    const a = card('a', 'goblin', ['N']);
    const b = card('b', 'fang', ['N']);
    const impact = discardImpact(a, [a, b]);
    expect(impact.losesArrows).toBe(false);
    expect(impact.points).toBe(10); // type only
  });

  it('charges 5 when the arrow pattern is unique to this card', () => {
    const a = card('a', 'goblin', ['N', 'E']);
    const dup = card('b', 'goblin', ['S']);
    const other = card('c', 'fang', ['S']);
    const impact = discardImpact(a, [a, dup, other]);
    expect(impact.losesType).toBe(false);
    expect(impact.losesArrows).toBe(true);
    expect(impact.points).toBe(5);
  });

  it('charges for losing the best class of a template', () => {
    const strong = card('a', 'goblin', ['N'], 'A');
    const weak = card('b', 'goblin', ['E'], 'P');
    const impact = discardImpact(strong, [strong, weak]);
    expect(impact.losesClass).toBe(2);
    expect(impact.reasons.join(' ')).toMatch(/best class/);
  });

  it('is never negative', () => {
    const a = card('a', 'goblin', ['N']);
    expect(discardImpact(a, [a]).points).toBeGreaterThanOrEqual(0);
    expect(discardImpact(a, []).points).toBe(0);
  });
});
