import type { SeedHex } from "./types.js";

const UINT32_RANGE = 0x1_0000_0000;
const SEED_PATTERN = /^[0-9a-f]{8}$/u;

export interface SeededRandom {
  nextBounded(maximumExclusive: number): number;
  nextUint32(): number;
}

export function parseSeedHex(seed: SeedHex): number {
  if (!SEED_PATTERN.test(seed)) {
    throw new RangeError("A seed must be exactly eight lowercase hexadecimal characters.");
  }
  const parsed = Number.parseInt(seed, 16) >>> 0;
  if (parsed === 0) {
    throw new RangeError("The all-zero seed is not valid for xorshift32.");
  }
  return parsed;
}

export function formatSeedHex(seed: number): SeedHex {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed >= UINT32_RANGE) {
    throw new RangeError("A numeric seed must be an unsigned nonzero 32-bit integer.");
  }
  return seed.toString(16).padStart(8, "0");
}

export function unbiasedBoundedSelection(
  nextUint32: () => number,
  maximumExclusive: number,
): number {
  if (
    !Number.isSafeInteger(maximumExclusive) ||
    maximumExclusive < 1 ||
    maximumExclusive > UINT32_RANGE
  ) {
    throw new RangeError("The exclusive bound must be an integer from 1 through 2^32.");
  }

  const acceptanceLimit =
    Math.floor(UINT32_RANGE / maximumExclusive) * maximumExclusive;
  for (;;) {
    const candidate = nextUint32();
    if (!Number.isSafeInteger(candidate) || candidate < 0 || candidate >= UINT32_RANGE) {
      throw new RangeError("The random source must return an unsigned 32-bit integer.");
    }
    if (candidate < acceptanceLimit) {
      return candidate % maximumExclusive;
    }
  }
}

export function createSeededRandom(seed: number | SeedHex): SeededRandom {
  if (
    typeof seed === "number" &&
    (!Number.isSafeInteger(seed) || seed < 1 || seed >= UINT32_RANGE)
  ) {
    throw new RangeError("A numeric seed must be an unsigned nonzero 32-bit integer.");
  }
  let state = typeof seed === "number" ? seed : parseSeedHex(seed);

  const nextUint32 = (): number => {
    let x = state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state = x >>> 0;
    return state;
  };

  return {
    nextUint32,
    nextBounded: (maximumExclusive) =>
      unbiasedBoundedSelection(nextUint32, maximumExclusive),
  };
}

export function seededShuffle<T>(
  values: readonly T[],
  random: Pick<SeededRandom, "nextBounded">,
): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = random.nextBounded(index + 1);
    const held = shuffled[index];
    shuffled[index] = shuffled[selected] as T;
    shuffled[selected] = held as T;
  }
  return shuffled;
}
