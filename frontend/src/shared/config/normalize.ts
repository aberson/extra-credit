/**
 * Normalize parent-entered text without changing its meaning. Unicode is kept
 * verbatim; only surrounding Unicode whitespace is removed.
 */
export function normalizeProfileText(value: string): string {
  return value.trim();
}

/**
 * Produce the comparison key used for case-insensitive interest uniqueness and
 * reviewed-topic matching. The stored spelling is intentionally kept separate.
 */
export function normalizedInterestKey(value: string): string {
  return normalizeProfileText(value).toLocaleLowerCase("en-US");
}

export function unicodeCharacterLength(value: string): number {
  return Array.from(value).length;
}

export function hasUniqueNormalizedInterests(
  interests: readonly string[],
): boolean {
  const keys = interests.map(normalizedInterestKey);
  return new Set(keys).size === keys.length;
}

export function normalizeInterestTags(interests: readonly string[]): string[] {
  return interests.map(normalizeProfileText);
}

/** Validate a unique ordered subset without silently changing parent choices. */
export function isCanonicalOrderedSubset<T extends string>(
  values: readonly T[],
  canonicalOrder: readonly T[],
): boolean {
  let previousIndex = -1;
  for (const value of values) {
    const currentIndex = canonicalOrder.indexOf(value);
    if (currentIndex <= previousIndex) {
      return false;
    }
    previousIndex = currentIndex;
  }
  return true;
}
