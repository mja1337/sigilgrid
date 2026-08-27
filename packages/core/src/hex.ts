import type { Hex } from './types.ts';

export function hexBand(h: Hex): [number, number] {
  return [16 * h, 16 * h + 15];
}

export function formatHex(h: number): string {
  if (h < 10) return String(h);
  return 'ABCDEF'[h - 10]!;
}

export function parseHexChar(ch: string): Hex {
  const upper = ch.toUpperCase();
  if (upper >= '0' && upper <= '9') return Number(upper) as Hex;
  const idx = 'ABCDEF'.indexOf(upper);
  if (idx >= 0) return (10 + idx) as Hex;
  throw new Error(`invalid hex ${ch}`);
}

export function bandLabel(h: Hex): string {
  const [lo, hi] = hexBand(h);
  return `${formatHex(h)} = ${lo}–${hi} power band`;
}

export function asHex(n: number): Hex {
  if (n < 0 || n > 15 || !Number.isInteger(n)) throw new Error(`invalid hex ${n}`);
  return n as Hex;
}
