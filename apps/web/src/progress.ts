import type { CardInstance, MatchState } from '@sigilgrid/core';
import { cardPower, powerBand } from '@sigilgrid/core';
import { COLLECTION_CAP, ENCOUNTERS, PACK_SIZE, PRACTICE_WIN_SEALS, REPEAT_WIN_SEALS, instantiateId, instantiatePack, instantiateTierPack, packTierById, type Encounter } from '@sigilgrid/content';
import type { SaveGame } from './save.ts';
import { isPreviousDay, todayKey } from './daily.ts';

export const CAP = COLLECTION_CAP;
export const HELD_CARD_REPLAY_CHANCE = 0.9;
export const CIRCUIT_FINALE_ID = 'a4-r3';

export function circuitFinished(save: SaveGame): boolean {
  return save.campaign.completed.includes(CIRCUIT_FINALE_ID);
}

export function wagerRivalUnlocked(save: SaveGame, unlockAfter: string): boolean {
  return save.campaign.completed.includes(unlockAfter);
}

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

/**
 * The five cards taken into a match. A deck can go stale (cards discarded, lost
 * to a wager) or be half-built, so the album tops the hand up rather than
 * letting a match start with fewer than five cards.
 */
export function deckCardsForMatch(save: SaveGame): CardInstance[] {
  const deck = save.decks.find((d) => d.id === save.activeDeckId);
  const picked: CardInstance[] = [];
  const used = new Set<string>();
  for (const id of deck?.instanceIds ?? []) {
    if (picked.length === 5 || used.has(id)) continue;
    const card = save.collection.find((c) => c.instanceId === id);
    if (!card) continue;
    used.add(id);
    picked.push(card);
  }
  for (const card of save.collection) {
    if (picked.length === 5) break;
    if (used.has(card.instanceId)) continue;
    used.add(card.instanceId);
    picked.push(card);
  }
  return picked;
}

/** How much of the active deck is actually playable, for deck readouts before a match. */
export function activeDeckSummary(save: SaveGame): {
  name: string;
  owned: number;
  borrowed: number;
  mix: string;
  power: number;
  band: string;
} {
  const deck = save.decks.find((d) => d.id === save.activeDeckId);
  const owned = new Set(
    (deck?.instanceIds ?? []).filter((id) => save.collection.some((c) => c.instanceId === id)),
  ).size;
  const cards = deckCardsForMatch(save);
  const counts: Record<string, number> = {};
  for (const card of cards) counts[card.battleClass] = (counts[card.battleClass] ?? 0) + 1;
  const mix = ['P', 'M', 'X', 'A']
    .filter((klass) => counts[klass])
    .map((klass) => `${counts[klass]}${klass}`)
    .join(' · ');
  const power = cards.reduce((sum, card) => sum + cardPower(card), 0);
  return {
    name: deck?.name ?? 'Album order',
    owned: Math.min(owned, 5),
    borrowed: Math.max(0, cards.length - Math.min(owned, 5)),
    mix: mix || 'empty',
    power,
    band: powerBand(Math.round(power / Math.max(1, cards.length))),
  };
}

export function lootInstanceId(encounterId: string, prize: CardInstance): string {
  return `taken-${encounterId}-${prize.templateId}`;
}

export function heldOpponentInstanceId(encounterId: string, card: CardInstance): string {
  return `o-held-${encounterId}-${card.instanceId}`;
}

export function isReclaimableLoot(
  save: SaveGame,
  prize: CardInstance,
  encounterId: string,
): boolean {
  return (save.opponentHoldings[encounterId] ?? []).some(
    (card) => heldOpponentInstanceId(encounterId, card) === prize.instanceId,
  );
}

function replayRoll(seed: number, instanceId: string): number {
  let hash = seed | 0;
  for (let i = 0; i < instanceId.length; i += 1) {
    hash = Math.imul(hash ^ instanceId.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/**
 * Cards this opponent won from the player and will put back into circulation.
 * The newest loss is guaranteed to appear; every older loss has a 90% chance.
 */
export function heldCardsForMatch(
  save: SaveGame,
  encounterId: string,
  seed: number,
): CardInstance[] {
  const held = save.opponentHoldings[encounterId] ?? [];
  return [...held]
    .reverse()
    .filter((card, index) => index === 0 || replayRoll(seed, card.instanceId) < HELD_CARD_REPLAY_CHANCE)
    .slice(0, 5)
    .map((card) => ({
      ...card,
      instanceId: heldOpponentInstanceId(encounterId, card),
      provenance: 'event',
    }));
}

/** Take a chosen spoil. Declining is a legitimate answer, so this is opt-in. */
export function claimLoot(save: SaveGame, prize: CardInstance, encounterId: string): SaveGame {
  const held = save.opponentHoldings[encounterId] ?? [];
  const original = held.find(
    (card) => heldOpponentInstanceId(encounterId, card) === prize.instanceId,
  );
  if (original) {
    if (save.collection.length >= CAP) return save;
    const opponentHoldings = {
      ...save.opponentHoldings,
      [encounterId]: held.filter((card) => card.instanceId !== original.instanceId),
    };
    if (opponentHoldings[encounterId]?.length === 0) delete opponentHoldings[encounterId];
    return {
      ...save,
      opponentHoldings,
      collection: save.collection.some((card) => card.instanceId === original.instanceId)
        ? save.collection
        : [...save.collection, original],
    };
  }

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

function grantChallengeRewards(save: SaveGame, encounter: Encounter): SaveGame {
  let seals = save.seals;
  let unlockedCosmetics = [...save.unlockedCosmetics];
  for (const r of encounter.rewards) {
    if (r.kind === 'seal') seals += r.count;
    if (r.kind === 'cosmetic') unlockedCosmetics = [...new Set([...unlockedCosmetics, r.id])];
  }
  return { ...save, seals, unlockedCosmetics };
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
    dailyDate?: string;
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

  if (opts.mode === 'challenge' && opts.encounter && won) {
    const done = next.campaign.challenges ?? [];
    if (!done.includes(opts.encounter.id)) {
      next.campaign = { ...next.campaign, challenges: [...done, opts.encounter.id] };
      next = grantChallengeRewards(next, opts.encounter);
    } else {
      next.seals += REPEAT_WIN_SEALS;
    }
  }

  if (opts.mode === 'practice' && won) {
    next.seals += PRACTICE_WIN_SEALS;
  }

  if (opts.mode === 'daily') {
    const sc = scoreDelta(opts.result);
    const date = opts.dailyDate ?? todayKey();
    const alreadyPacked = next.daily.date === date && Boolean(next.daily.packClaimed);
    const best = next.daily.date === date ? Math.max(next.daily.bestScore ?? -99, sc) : sc;
    const firstWinToday = won && next.daily.lastWinDate !== date;
    const streak = firstWinToday
      ? isPreviousDay(next.daily.lastWinDate, date)
        ? next.daily.streak + 1
        : 1
      : next.daily.streak;
    next.daily = {
      date,
      bestScore: best,
      packClaimed: alreadyPacked || won,
      streak,
      lastWinDate: firstWinToday ? date : next.daily.lastWinDate,
    };
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
    const lostCard = lost ? next.collection.find((card) => card.instanceId === lost) : undefined;
    if (lost && lostCard && opts.encounter) {
      next.collection = next.collection.filter((c) => c.instanceId !== lost);
      next.decks = next.decks.map((d) => ({ ...d, instanceIds: d.instanceIds.filter((id) => id !== lost) }));
      const held = next.opponentHoldings[opts.encounter.id] ?? [];
      next.opponentHoldings = {
        ...next.opponentHoldings,
        [opts.encounter.id]: held.some((card) => card.instanceId === lostCard.instanceId)
          ? held
          : [...held, lostCard],
      };
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
