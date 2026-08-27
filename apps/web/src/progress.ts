import type { CardInstance, MatchState } from '@sigilgrid/core';
import {
  ENCOUNTERS,
  instantiateId,
  instantiatePack,
  ownedTemplateIds,
  PACK_SIZE,
  PRACTICE_WIN_SEALS,
  REPEAT_WIN_SEALS,
  SEAL_PACK_COST,
  sealCost,
  templateById,
  type Encounter,
} from '@sigilgrid/content';
import type { SaveGame } from './save.ts';

function mergePlayed(collection: CardInstance[], result: MatchState): CardInstance[] {
  return collection.map((c) => result.cards[c.instanceId] ?? c);
}

function capturedPrize(result: MatchState): CardInstance | null {
  for (const cell of result.board) {
    const occ = cell.occupant;
    if (!occ || occ.owner !== 'player') continue;
    const card = result.cards[occ.instanceId];
    if (card && occ.instanceId.startsWith('o-')) return card;
  }
  return null;
}

function grantCaptured(collection: CardInstance[], prize: CardInstance, encounterId: string): CardInstance[] {
  const instanceId = `taken-${encounterId}-${prize.templateId}`;
  if (collection.some((c) => c.instanceId === instanceId)) return collection;
  return [...collection, { ...prize, instanceId, provenance: 'drop' }];
}

function grantCard(
  collection: CardInstance[],
  templateId: string,
  seed: number,
  instanceId: string,
  provenance: CardInstance['provenance'],
): CardInstance[] {
  if (collection.some((c) => c.instanceId === instanceId)) return collection;
  return [...collection, instantiateId(templateId, seed, provenance, instanceId)];
}

function scoreDelta(result: MatchState): number {
  let player = 0;
  let opponent = 0;
  for (const cell of result.board) {
    if (cell.occupant?.owner === 'player') player += 1;
    if (cell.occupant?.owner === 'opponent') opponent += 1;
  }
  return player - opponent;
}

export function grantStoryRewards(save: SaveGame, encounter: Encounter, seed: number): SaveGame {
  let collection = [
    ...save.collection,
    ...instantiatePack(save.collection, seed + 700, `pack-${encounter.id}`, PACK_SIZE),
  ];
  let seals = save.seals;
  let loreIds = [...save.loreIds];
  let unlockedCosmetics = [...save.unlockedCosmetics];

  for (const r of encounter.rewards) {
    if (r.kind === 'card') {
      collection = grantCard(
        collection,
        r.templateId,
        seed + 500,
        `reward-${encounter.id}-${r.templateId}`,
        'reward',
      );
    }
    if (r.kind === 'seal') seals += r.count;
    if (r.kind === 'lore') loreIds = [...new Set([...loreIds, r.id])];
    if (r.kind === 'cosmetic') unlockedCosmetics = [...new Set([...unlockedCosmetics, r.id])];
    if (r.kind === 'pack') {
      collection = [
        ...collection,
        ...instantiatePack(collection, seed + 900, `pack-${encounter.id}-extra`, r.count * PACK_SIZE),
      ];
    }
  }

  return { ...save, collection, seals, loreIds, unlockedCosmetics };
}

export function applyMatchToSave(
  save: SaveGame,
  opts: {
    mode: string;
    encounter?: Encounter;
    result: MatchState;
    seed: number;
    wager: boolean;
    epilogue?: 'seal' | 'use';
  },
): SaveGame {
  const won = opts.result.winner === 'player';
  let next: SaveGame = {
    ...save,
    collection: mergePlayed(save.collection, opts.result),
  };

  if (opts.mode === 'story' && opts.encounter) {
    if (won) {
      const prize = capturedPrize(opts.result);
      if (prize) next.collection = grantCaptured(next.collection, prize, opts.encounter.id);
      if (!save.campaign.completed.includes(opts.encounter.id)) {
        const completed = [...save.campaign.completed, opts.encounter.id];
        const idx = ENCOUNTERS.findIndex((e) => e.id === opts.encounter!.id);
        next.campaign = {
          ...next.campaign,
          completed,
          nextId: ENCOUNTERS[idx + 1]?.id ?? opts.encounter.id,
          epilogue: opts.epilogue ?? next.campaign.epilogue,
        };
        next.wagerUnlocked = completed.includes('a2-mage') || next.wagerUnlocked;
        next = grantStoryRewards(next, opts.encounter, opts.seed);
      } else {
        next.seals += REPEAT_WIN_SEALS;
      }
    }
  }

  if (opts.mode === 'practice' && won) {
    next.seals += PRACTICE_WIN_SEALS;
  }

  if (opts.mode === 'daily') {
    const sc = scoreDelta(opts.result);
    const date = new Date().toISOString().slice(0, 10);
    const alreadyPacked = next.daily.date === date && Boolean(next.daily.packClaimed);
    const best = next.daily.date === date ? Math.max(next.daily.bestScore ?? -99, sc) : sc;
    next.daily = { date, bestScore: best, packClaimed: alreadyPacked || won };
    if (won && !alreadyPacked) {
      next.collection = [
        ...next.collection,
        ...instantiatePack(next.collection, opts.seed, `daily-${date}`, PACK_SIZE),
      ];
    }
  }

  if (opts.wager && opts.result.winner === 'opponent') {
    const deck = next.decks.find((d) => d.id === next.activeDeckId);
    const lost = deck?.instanceIds[0];
    if (lost) {
      next.collection = next.collection.filter((c) => c.instanceId !== lost);
      next.decks = next.decks.map((d) => ({ ...d, instanceIds: d.instanceIds.filter((id) => id !== lost) }));
    }
  }

  return next;
}

export function buyTemplate(save: SaveGame, templateId: string): SaveGame | string {
  let template;
  try {
    template = templateById(templateId);
  } catch {
    return 'Unknown card.';
  }
  const cost = sealCost(template.rarity);
  if (save.seals < cost) return `Need ${cost} seals.`;
  if (ownedTemplateIds(save.collection).has(templateId)) return 'You already own this card.';
  return {
    ...save,
    seals: save.seals - cost,
    collection: [...save.collection, instantiateId(templateId, 9000 + cost, 'event', `shop-${templateId}`)],
  };
}

export function buyPack(save: SaveGame, seed: number): SaveGame | string {
  if (save.seals < SEAL_PACK_COST) return `Need ${SEAL_PACK_COST} seals.`;
  return {
    ...save,
    seals: save.seals - SEAL_PACK_COST,
    collection: [...save.collection, ...instantiatePack(save.collection, seed, `shop-pack-${seed}`, PACK_SIZE)],
  };
}
