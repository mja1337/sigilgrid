export type Rng = {
  /** Next float in [0, 1). */
  next(): number;
  /** Inclusive integer range. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  getState(): number;
};

/** Mulberry32 with serializable 32-bit state. Never uses Math.random. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number) {
      if (max < min) throw new Error(`invalid range ${min}..${max}`);
      if (min === max) return min;
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]) {
      if (items.length === 0) throw new Error('pick empty');
      return items[this.int(0, items.length - 1)]!;
    },
    getState() {
      return s;
    },
  };
}

export function rngFromState(state: number): Rng {
  const rng = createRng(0);
  // Recreate with exact state by wrapping.
  let s = state >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number) {
      if (max < min) throw new Error(`invalid range ${min}..${max}`);
      if (min === max) return min;
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]) {
      if (items.length === 0) throw new Error('pick empty');
      return items[this.int(0, items.length - 1)]!;
    },
    getState() {
      return s;
    },
  };
}
