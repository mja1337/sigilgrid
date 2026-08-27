import { hexBand } from './hex.ts';
import { rngFromState, type Rng } from './rng.ts';
import type { BattleClass, BattleDetail, CardInstance, Hex, NumericStat } from './types.ts';

function sampleBand(rng: Rng, h: Hex): { band: [number, number]; value: number } {
  const band = hexBand(h);
  return { band, value: rng.int(band[0], band[1]) };
}

function sampleAttr(
  rng: Rng,
  card: CardInstance,
  key: NumericStat,
): { band: [number, number]; value: number; key: NumericStat } {
  const h = card[key];
  const s = sampleBand(rng, h);
  return { ...s, key };
}

export function resolveBattle(
  rng: Rng,
  attacker: CardInstance,
  defender: CardInstance,
): { winnerIsAttacker: boolean; detail: BattleDetail } {
  const cls: BattleClass = attacker.battleClass;
  let attackBase: number;
  let defenseBase: number;
  let attackBand: [number, number];
  let defenseBand: [number, number];
  let attackerAttr: BattleDetail['attackerAttr'];
  let defenderAttr: BattleDetail['defenderAttr'];

  if (cls === 'P') {
    const a = sampleAttr(rng, attacker, 'attack');
    const d = sampleAttr(rng, defender, 'physicalDefense');
    attackBase = a.value;
    defenseBase = d.value;
    attackBand = a.band;
    defenseBand = d.band;
    attackerAttr = 'attack';
    defenderAttr = 'physicalDefense';
  } else if (cls === 'M') {
    const a = sampleAttr(rng, attacker, 'attack');
    const d = sampleAttr(rng, defender, 'magicalDefense');
    attackBase = a.value;
    defenseBase = d.value;
    attackBand = a.band;
    defenseBand = d.band;
    attackerAttr = 'attack';
    defenderAttr = 'magicalDefense';
  } else if (cls === 'X') {
    const a = sampleAttr(rng, attacker, 'attack');
    const p = sampleAttr(rng, defender, 'physicalDefense');
    const m = sampleAttr(rng, defender, 'magicalDefense');
    const lower = p.value <= m.value ? p : m;
    attackBase = a.value;
    defenseBase = lower.value;
    attackBand = a.band;
    defenseBand = lower.band;
    attackerAttr = 'attack';
    defenderAttr = lower.key;
  } else {
    const aA = sampleAttr(rng, attacker, 'attack');
    const aP = sampleAttr(rng, attacker, 'physicalDefense');
    const aM = sampleAttr(rng, attacker, 'magicalDefense');
    const dA = sampleAttr(rng, defender, 'attack');
    const dP = sampleAttr(rng, defender, 'physicalDefense');
    const dM = sampleAttr(rng, defender, 'magicalDefense');
    const atkBest = [aA, aP, aM].reduce((b, x) => (x.value > b.value ? x : b));
    const defWorst = [dA, dP, dM].reduce((b, x) => (x.value < b.value ? x : b));
    attackBase = atkBest.value;
    defenseBase = defWorst.value;
    attackBand = atkBest.band;
    defenseBand = defWorst.band;
    attackerAttr = atkBest.key;
    defenderAttr = defWorst.key;
  }

  const attackExertion = rng.int(0, attackBase);
  const defenseExertion = rng.int(0, defenseBase);
  const attackFinal = attackBase - attackExertion;
  const defenseFinal = defenseBase - defenseExertion;
  const winnerIsAttacker = attackFinal > defenseFinal;

  return {
    winnerIsAttacker,
    detail: {
      attackerClass: cls,
      attackBand,
      defenseBand,
      attackBase,
      defenseBase,
      attackExertion,
      defenseExertion,
      attackFinal,
      defenseFinal,
      attackerAttr,
      defenderAttr,
    },
  };
}

/** Monte Carlo estimate in [0,1] using a forked RNG. Does not mutate match rng. */
export function estimateWinChance(
  seedState: number,
  attacker: CardInstance,
  defender: CardInstance,
  samples = 48,
): number {
  const rng = rngFromState(seedState ^ 0x9e3779b9);
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    if (resolveBattle(rng, attacker, defender).winnerIsAttacker) wins++;
  }
  return wins / samples;
}

export function chanceBand(p: number): { low: number; high: number } {
  const pad = 0.08;
  const low = Math.max(0, Math.round((p - pad) * 100));
  const high = Math.min(100, Math.round((p + pad) * 100));
  return { low, high };
}
