/**
 * Fake clock for deterministic testing.
 *
 * Allows tests to control time and advance it manually.
 */

import type { Clock } from "../core/clock.js";

/**
 * Fake clock class for testing.
 */
export class FakeClock implements Clock {
  private currentTime: number;

  constructor(startMs: number = 0) {
    this.currentTime = startMs;
  }

  /**
   * Get the current time.
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Advance the clock by a number of milliseconds.
   */
  advance(ms: number): void {
    this.currentTime += ms;
  }

  /**
   * Set the clock to an absolute time.
   */
  set(ms: number): void {
    this.currentTime = ms;
  }
}

/**
 * Create a fake clock for testing.
 *
 * @param startMs Initial time (default: 0)
 * @returns Fake clock
 */
export function createFakeClock(startMs: number = 0): FakeClock {
  return new FakeClock(startMs);
}
