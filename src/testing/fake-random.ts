/**
 * Fake random source for deterministic testing.
 *
 * Allows tests to provide scripted pseudo-random sequences.
 */

import type { RandomSource } from "../core/random.js";

/**
 * Fake random source interface (extends RandomSource with manual control).
 */
export interface FakeRandom extends RandomSource {
  /**
   * Push a sequence of values to be returned on subsequent next() calls.
   */
  pushSequence(values: number[]): void;
}

/**
 * Create a fake random source for testing.
 *
 * @param defaultValue Default value to return if sequence is exhausted (default: 0)
 * @returns Fake random source
 */
export function createFakeRandom(defaultValue: number = 0): FakeRandom {
  const queue: number[] = [];

  return {
    next(): number {
      if (queue.length > 0) {
        return queue.shift()!;
      }
      return defaultValue;
    },

    pushSequence(values: number[]): void {
      queue.push(...values);
    },
  };
}
