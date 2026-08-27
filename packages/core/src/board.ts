import { neighbor } from './directions.ts';
import { createRng, type Rng } from './rng.ts';
import { DIRECTIONS, type CellState } from './types.ts';

export function emptyBoard(): CellState[] {
  return Array.from({ length: 16 }, () => ({ blocked: false, occupant: null }));
}

export function applyBlocks(board: CellState[], blocked: number[]): CellState[] {
  const next = board.map((c) => ({ ...c }));
  for (const i of blocked) {
    if (i < 0 || i > 15) throw new Error(`invalid block ${i}`);
    next[i] = { blocked: true, occupant: null };
  }
  return next;
}

/**
 * Seeded 0–6 blocked cells, biased toward adjacent clusters so the grid
 * reads as irregular closed areas (Tetra Master–style closures).
 */
export function generateBlockedCells(rng: Rng): number[] {
  const n = rng.int(0, 6);
  if (n === 0) return [];
  const blocked = new Set<number>();
  blocked.add(rng.int(0, 15));
  while (blocked.size < n) {
    const grow = rng.next() < 0.65;
    if (grow) {
      const seeds = [...blocked];
      const from = seeds[rng.int(0, seeds.length - 1)]!;
      const adj = DIRECTIONS.map((d) => neighbor(from, d)).filter(
        (c): c is number => c !== null && !blocked.has(c),
      );
      if (adj.length > 0) {
        blocked.add(adj[rng.int(0, adj.length - 1)]!);
        continue;
      }
    }
    const pool: number[] = [];
    for (let i = 0; i < 16; i++) if (!blocked.has(i)) pool.push(i);
    blocked.add(pool[rng.int(0, pool.length - 1)]!);
  }
  return [...blocked].sort((a, b) => a - b);
}

export function generateBlockedFromSeed(seed: number): number[] {
  return generateBlockedCells(createRng(seed));
}

export function cloneBoard(board: CellState[]): CellState[] {
  return board.map((c) => ({
    blocked: c.blocked,
    occupant: c.occupant ? { ...c.occupant } : null,
  }));
}
