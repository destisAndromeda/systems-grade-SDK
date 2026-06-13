/**
 * Fake random source for deterministic testing.
 *
 * Allows tests to provide scripted pseudo-random sequences.
 */

import type { RandomSource } from "../core/random.js";

/**
 * Fake random source class for testing.
 */
export class FakeRandom implements RandomSource {
  private queue: number[];

  constructor(values: number[] = [], private defaultValue: number = 0) {
    this.queue = [...values];
  }

  /**
   * Get the next random value.
   */
  next(): number {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    return this.defaultValue;
  }

  /**
   * Get the next random value as an integer in range [0, max).
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /**
   * Get the next random value as a float in range [0, 1).
   */
  nextFloat(): number {
    return this.next();
  }

  /**
   * Push a sequence of values to be returned on subsequent next() calls.
   */
  pushSequence(values: number[]): void {
    this.queue.push(...values);
  }
}

/**
 * Create a fake random source for testing.
 *
 * @param defaultValue Default value to return if sequence is exhausted (default: 0)
 * @returns Fake random source
 */
export function createFakeRandom(defaultValue: number = 0): FakeRandom {
  return new FakeRandom([], defaultValue);
}
