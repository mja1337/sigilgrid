import { createRng, type CardInstance } from '@sigilgrid/core';
import { TEMPLATES, type CardTemplate } from './templates.ts';
import { instantiateId } from './instantiate.ts';

export const PACK_SIZE = 3;
export const SEAL_PACK_COST = 2;
export const REPEAT_WIN_SEALS = 1;
export const PRACTICE_WIN_SEALS = 1;

/** Album slots. Matches the template count, so a perfect album is exactly full. */
export const COLLECTION_CAP = 100;

export type Rarity = CardTemplate['rarity'];
export type RarityWeights = Partial<Record<Rarity, number>>;

export type PackTier = {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  size: number;
  weights: RarityWeights;
  /** At least one card of this rarity or better, if the pool can supply it. */
  floor?: Rarity;
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'relic'];

export const PACK_TIERS: PackTier[] = [
  {
    id: 'ashfall',
    name: 'Ashfall Wrap',
    blurb: 'Cheap market paper. Mostly common sigils, the odd surprise.',
    cost: 2,
    size: 3,
    weights: { common: 70, uncommon: 25, rare: 5 },
  },
  {
    id: 'ember',
    name: 'Ember Seal',
    blurb: 'Stall-wright stock. A real shot at something rare.',
    cost: 5,
    size: 3,
    weights: { common: 40, uncommon: 35, rare: 20, relic: 5 },
  },
  {
    id: 'lantern',
    name: 'Black Lantern',
    blurb: 'Archive-grade. Five cards, and never all chaff.',
    cost: 10,
    size: 5,
    weights: { uncommon: 40, rare: 40, relic: 20 },
    floor: 'rare',
  },
];

export function packTierById(id: string): PackTier | undefined {
  return PACK_TIERS.find((t) => t.id === id);
}

function weightedRarity(weights: RarityWeights, roll: number): Rarity {
  const entries = RARITY_ORDER.map((r) => [r, weights[r] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let acc = 0;
  const target = roll * total;
  for (const [rarity, w] of entries) {
    acc += w;
    if (target < acc) return rarity;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Draw a pack. Unowned cards are always preferred so a purchase moves the
 * album forward; duplicates only appear once that rarity is exhausted.
 */
export function rollPack(
  tier: PackTier,
  collection: readonly CardInstance[],
  seed: number,
): string[] {
  const rng = createRng(seed);
  const owned = ownedTemplateIds(collection);
  const taken = new Set<string>();
  const picked: string[] = [];

  const drawOf = (rarity: Rarity): string | null => {
    const of = (pool: CardTemplate[]) => pool.filter((t) => t.rarity === rarity && !taken.has(t.templateId));
    const fresh = of(TEMPLATES.filter((t) => !owned.has(t.templateId)));
    const bag = fresh.length ? fresh : of([...TEMPLATES]);
    if (!bag.length) return null;
    const choice = bag[rng.int(0, bag.length - 1)]!;
    taken.add(choice.templateId);
    return choice.templateId;
  };

  for (let i = 0; i < tier.size; i++) {
    let rarity = weightedRarity(tier.weights, rng.next());
    // The floor applies to the last card, so a guaranteed pack cannot roll
    // its way out of the guarantee.
    const isLast = i === tier.size - 1;
    if (tier.floor && isLast && !picked.some((id) => meetsFloor(id, tier.floor!))) {
      rarity = tier.floor;
    }
    let id = drawOf(rarity);
    if (!id) {
      for (const alt of [...RARITY_ORDER].reverse()) {
        id = drawOf(alt);
        if (id) break;
      }
    }
    if (id) picked.push(id);
  }
  return picked;
}

function meetsFloor(templateId: string, floor: Rarity): boolean {
  const t = TEMPLATES.find((x) => x.templateId === templateId);
  if (!t) return false;
  return RARITY_ORDER.indexOf(t.rarity) >= RARITY_ORDER.indexOf(floor);
}

export function instantiateTierPack(
  tier: PackTier,
  collection: readonly CardInstance[],
  seed: number,
  prefix: string,
): CardInstance[] {
  return rollPack(tier, collection, seed).map((id, i) =>
    instantiateId(id, seed + i * 19 + 7, 'drop', `${prefix}-${id}-${i}`),
  );
}

export const DECK_PRESETS = [
  { id: 'beginner', name: 'Beginner balanced', templates: ['goblin', 'fang', 'skeleton', 'flan', 'zaghnol'] },
  { id: 'combo', name: 'Combo bait', templates: ['bomb', 'mimic', 'mandragora', 'nymph', 'cactuar'] },
  { id: 'counter', name: 'Counter edges', templates: ['zombie', 'ironite', 'sahagin', 'lizardman', 'yeti'] },
  { id: 'opportunistic', name: 'Opportunistic', templates: ['crawler', 'sand-scorpion', 'dragonfly', 'wyerd', 'flan'] },
] as const;

export const STARTER_DECKS: Record<string, readonly string[]> = Object.fromEntries(
  DECK_PRESETS.map((d) => [d.id, d.templates]),
);

export function sealCost(rarity: CardTemplate['rarity']): number {
  if (rarity === 'common') return 1;
  if (rarity === 'uncommon') return 2;
  if (rarity === 'rare') return 3;
  return 4;
}

export function ownedTemplateIds(cards: readonly CardInstance[]): Set<string> {
  return new Set(cards.map((c) => c.templateId));
}

export function unownedTemplates(cards: readonly CardInstance[]): CardTemplate[] {
  const owned = ownedTemplateIds(cards);
  return TEMPLATES.filter((t) => !owned.has(t.templateId));
}

export function pickPack(cards: readonly CardInstance[], seed: number, count = PACK_SIZE): string[] {
  const rng = createRng(seed);
  const missing = unownedTemplates(cards);
  const pool = missing.length > 0 ? missing : [...TEMPLATES];
  const picked: string[] = [];
  const bag = [...pool];
  for (let i = 0; i < count && bag.length; i++) {
    const idx = rng.int(0, bag.length - 1);
    picked.push(bag.splice(idx, 1)[0]!.templateId);
  }
  return picked;
}

export function instantiatePack(
  cards: readonly CardInstance[],
  seed: number,
  prefix: string,
  count = PACK_SIZE,
): CardInstance[] {
  return pickPack(cards, seed, count).map((id, i) =>
    instantiateId(id, seed + i * 19, 'drop', `${prefix}-${id}`),
  );
}

export function resolvePresetDeck(
  collection: readonly CardInstance[],
  templates: readonly string[],
): string[] | null {
  const ids: string[] = [];
  const used = new Set<string>();
  for (const templateId of templates) {
    const card = collection.find((c) => c.templateId === templateId && !used.has(c.instanceId));
    if (!card) return null;
    used.add(card.instanceId);
    ids.push(card.instanceId);
  }
  return ids;
}

export function decksFromCollection(collection: readonly CardInstance[]): {
  id: string;
  name: string;
  instanceIds: string[];
}[] {
  const decks = [];
  for (const preset of DECK_PRESETS) {
    const instanceIds = resolvePresetDeck(collection, preset.templates);
    if (instanceIds) decks.push({ id: preset.id, name: preset.name, instanceIds });
  }
  if (decks.length === 0) {
    decks.push({
      id: 'beginner',
      name: 'Beginner balanced',
      instanceIds: collection.slice(0, 5).map((c) => c.instanceId),
    });
  }
  return decks;
}
