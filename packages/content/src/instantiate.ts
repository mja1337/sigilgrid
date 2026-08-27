import { createRng, makeCard, type CardInstance, type Provenance } from '@sigilgrid/core';
import { templateById, type CardTemplate } from './templates.ts';

export function instantiateTemplate(
  template: CardTemplate,
  seed: number,
  provenance: Provenance,
  instanceId: string,
): CardInstance {
  const rng = createRng(seed);
  const arrows = rng.pick(template.arrowVariants);
  return makeCard({
    instanceId,
    templateId: template.templateId,
    displayName: template.displayName,
    rarity: template.rarity,
    arrows,
    attack: template.attack,
    battleClass: template.battleClass,
    physicalDefense: template.physicalDefense,
    magicalDefense: template.magicalDefense,
    provenance,
    history: [{ kind: 'created', at: new Date(0).toISOString(), note: provenance }],
  });
}

export function instantiateId(templateId: string, seed: number, provenance: Provenance, instanceId: string): CardInstance {
  return instantiateTemplate(templateById(templateId), seed, provenance, instanceId);
}

export const STARTER_TEMPLATE_IDS = [
  'goblin',
  'fang',
  'skeleton',
  'flan',
  'zaghnol',
  'lizardman',
  'zombie',
  'bomb',
  'sahagin',
  'yeti',
  'mimic',
  'mandragora',
] as const;

export function createStarterCollection(seed = 1001): CardInstance[] {
  return STARTER_TEMPLATE_IDS.map((id, i) => instantiateId(id, seed + i * 17, 'starter', `starter-${id}`));
}

export const STARTER_DECKS: Record<string, string[]> = {
  beginner: ['goblin', 'fang', 'skeleton', 'flan', 'zaghnol'],
  combo: ['bomb', 'mimic', 'mandragora', 'nymph', 'cactuar'],
  counter: ['zombie', 'ironite', 'sahagin', 'lizardman', 'yeti'],
  opportunistic: ['crawler', 'sand-scorpion', 'dragonfly', 'wyerd', 'flan'],
};
