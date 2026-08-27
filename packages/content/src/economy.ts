import { createRng, type CardInstance } from '@sigilgrid/core';
import { TEMPLATES, type CardTemplate } from './templates.ts';
import { instantiateId } from './instantiate.ts';

export const PACK_SIZE = 3;
export const SEAL_PACK_COST = 2;
export const REPEAT_WIN_SEALS = 1;
export const PRACTICE_WIN_SEALS = 1;

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
