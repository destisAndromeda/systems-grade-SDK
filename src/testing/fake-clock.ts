/**
 * Fake clock for deterministic testing.
 *
 * Allows tests to control time and advance it manually.
 */

import type { Clock } from "../core/clock.js";

/**
 * Fake clock interface (extends Clock with manual control).
 */
export interface FakeClock extends Clock {
  /**
   * Advance the clock by a number of milliseconds.
   */
  advance(ms: number): void;

  /**
   * Set the clock to an absolute time.
   */
  set(ms: number): void;
}

/**
 * Create a fake clock for testing.
 *
 * @param startMs Initial time (default: 0)
 * @returns Fake clock
 */
export function createFakeClock(startMs: number = 0): FakeClock {
  let currentTime = startMs;

  return {
    now(): number {
      return currentTime;
    },

    advance(ms: number): void {
      currentTime += ms;
    },

    set(ms: number): void {
      currentTime = ms;
    },
  };
}
