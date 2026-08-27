import type { CardInstance, MatchState } from '@sigilgrid/core';
import {
  COLLECTION_CAP,
  ENCOUNTERS,
  instantiateId,
  instantiatePack,
  instantiateTierPack,
  packTierById,
  PACK_SIZE,
  PRACTICE_WIN_SEALS,
  REPEAT_WIN_SEALS,
  type Encounter,
} from '@sigilgrid/content';
import type { SaveGame } from './save.ts';

export const CAP = COLLECTION_CAP;

export function freeSlots(save: SaveGame): number {
  return Math.max(0, CAP - save.collection.length);
}

/** Album slots are finite, so anything granted has to fit. */
function addWithinCap(collection: CardInstance[], incoming: CardInstance[]): CardInstance[] {
  const room = Math.max(0, CAP - collection.length);
  return [...collection, ...incoming.slice(0, room)];
}

function mergePlayed(collection: CardInstance[], result: MatchState): CardInstance[] {
  return collection.map((c) => result.cards[c.instanceId] ?? c);
}

/** Opponent cards still flipped to your colour when the match ended. */
export function lootCandidates(result: MatchState): CardInstance[] {
  const out: CardInstance[] = [];
  for (const cell of result.board) {
    const occ = cell.occupant;
    if (!occ || occ.owner !== 'player') continue;
    const card = result.cards[occ.instanceId];
    if (card && occ.instanceId.startsWith('o-')) out.push(card);
  }
  return out;
}

export function lootInstanceId(encounterId: string, prize: CardInstance): string {
  return `taken-${encounterId}-${prize.templateId}`;
}

/** Take a chosen spoil. Declining is a legitimate answer, so this is opt-in. */
export function claimLoot(save: SaveGame, prize: CardInstance, encounterId: string): SaveGame {
  const instanceId = lootInstanceId(encounterId, prize);
  if (save.collection.some((c) => c.instanceId === instanceId)) return save;
  if (save.collection.length >= CAP) return save;
  return {
    ...save,
    collection: [...save.collection, { ...prize, instanceId, provenance: 'drop' }],
  };
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
  let collection = addWithinCap(
    [...save.collection],
    instantiatePack(save.collection, seed + 700, `pack-${encounter.id}`, PACK_SIZE),
  );
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
      collection = addWithinCap(
        collection,
        instantiatePack(collection, seed + 900, `pack-${encounter.id}-extra`, r.count * PACK_SIZE),
      );
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
      next.collection = addWithinCap(
        next.collection,
        instantiatePack(next.collection, opts.seed, `daily-${date}`, PACK_SIZE),
      );
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

export type PackPurchase = { save: SaveGame; pulled: CardInstance[] };

/**
 * Buy a sealed pack. The cards come back alongside the new save so the UI can
 * play the opening before they appear in the album.
 */
export function buyPackTier(save: SaveGame, tierId: string, seed: number): PackPurchase | string {
  const tier = packTierById(tierId);
  if (!tier) return 'Unknown pack.';
  if (save.seals < tier.cost) {
    const short = tier.cost - save.seals;
    return `${tier.name} costs ${tier.cost} seals — ${short} more to go.`;
  }
  if (freeSlots(save) < tier.size) {
    return `Not enough album space: ${tier.name} holds ${tier.size} cards and you have ${freeSlots(save)} free. Discard something first.`;
  }
  const pulled = instantiateTierPack(tier, save.collection, seed, `${tier.id}-${seed}`);
  return {
    save: { ...save, seals: save.seals - tier.cost, collection: [...save.collection, ...pulled] },
    pulled,
  };
}

export function discardCard(save: SaveGame, instanceId: string): SaveGame {
  return {
    ...save,
    collection: save.collection.filter((c) => c.instanceId !== instanceId),
    decks: save.decks.map((d) => ({
      ...d,
      instanceIds: d.instanceIds.filter((id) => id !== instanceId),
    })),
  };
}
