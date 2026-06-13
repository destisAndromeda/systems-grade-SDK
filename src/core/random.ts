/**
 * RandomSource interface and implementations.
 *
 * Abstracts randomness so tests can provide scripted pseudo-random sequences.
 * Used for jitter in backoff and hedging delays.
 */

/**
 * Randomness source interface.
 */
export interface RandomSource {
  /**
   * Return a random number in the range [0, 1).
   */
  next(): number;
}

/**
 * Create a randomness source using Math.random().
 */
export function createMathRandomSource(): RandomSource {
  return {
    next(): number {
      return Math.random();
    },
  };
}
