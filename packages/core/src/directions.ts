import type { Direction } from './types.ts';

export const OPPOSITE: Record<Direction, Direction> = {
  N: 'S',
  NE: 'SW',
  E: 'W',
  SE: 'NW',
  S: 'N',
  SW: 'NE',
  W: 'E',
  NW: 'SE',
};

export const OFFSET: Record<Direction, [number, number]> = {
  N: [-1, 0],
  NE: [-1, 1],
  E: [0, 1],
  SE: [1, 1],
  S: [1, 0],
  SW: [1, -1],
  W: [0, -1],
  NW: [-1, -1],
};

export function cellToRc(index: number): [number, number] {
  return [Math.floor(index / 4), index % 4];
}

export function rcToCell(r: number, c: number): number | null {
  if (r < 0 || r > 3 || c < 0 || c > 3) return null;
  return r * 4 + c;
}

export function neighbor(index: number, dir: Direction): number | null {
  const [r, c] = cellToRc(index);
  const [dr, dc] = OFFSET[dir];
  return rcToCell(r + dr, c + dc);
}

export function hasArrow(arrows: readonly Direction[], dir: Direction): boolean {
  return arrows.includes(dir);
}
