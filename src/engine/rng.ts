/**
 * Deterministic seeded RNG (mulberry32). The RNG state lives inside the game
 * state so every game is reproducible from its seed and action log.
 */
export interface RngState {
  s: number;
}

export function seedRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** Returns a float in [0, 1) and the advanced state. Pure — does not mutate. */
export function nextFloat(state: RngState): { value: number; state: RngState } {
  let t = (state.s + 0x6d2b79f5) >>> 0;
  const s = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: { s } };
}

/** Integer in [min, max] inclusive. */
export function nextInt(
  state: RngState,
  min: number,
  max: number,
): { value: number; state: RngState } {
  const r = nextFloat(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), state: r.state };
}

/** Fisher–Yates shuffle, returns a new array and the advanced state. */
export function shuffle<T>(state: RngState, items: readonly T[]): { value: T[]; state: RngState } {
  const arr = items.slice();
  let s = state;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextInt(s, 0, i);
    s = r.state;
    [arr[i], arr[r.value]] = [arr[r.value], arr[i]];
  }
  return { value: arr, state: s };
}
