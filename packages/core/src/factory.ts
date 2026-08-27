import type { CardInstance, Direction, Hex, BattleClass, Rarity } from './types.ts';

let seq = 0;

export function makeCard(partial: Partial<CardInstance> & { arrows: Direction[] }): CardInstance {
  seq += 1;
  return {
    instanceId: partial.instanceId ?? `card-${seq}`,
    templateId: partial.templateId ?? 'test',
    displayName: partial.displayName ?? 'Test Sigil',
    rarity: (partial.rarity ?? 'common') as Rarity,
    arrows: [...partial.arrows],
    attack: (partial.attack ?? 8) as Hex,
    battleClass: (partial.battleClass ?? 'P') as BattleClass,
    physicalDefense: (partial.physicalDefense ?? 8) as Hex,
    magicalDefense: (partial.magicalDefense ?? 8) as Hex,
    masteryXp: partial.masteryXp ?? 0,
    masteryLevel: partial.masteryLevel ?? 0,
    victories: partial.victories ?? 0,
    battleHistory: partial.battleHistory ?? { wins: 0, losses: 0, placements: 0 },
    provenance: partial.provenance ?? 'starter',
    history: partial.history ?? [],
  };
}

export function resetCardSeq(): void {
  seq = 0;
}
