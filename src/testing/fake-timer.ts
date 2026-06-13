/**
 * Fake timer for deterministic testing.
 *
 * Allows tests to schedule callbacks and execute them manually.
 */

import type { Timer } from "../core/timer.js";
import type { FakeClock } from "./fake-clock.js";

/**
 * Fake timer interface (extends Timer with manual control).
 */
export interface FakeTimer extends Timer {
  /**
   * Get the number of pending callbacks.
   */
  pendingCount(): number;

  /**
   * Flush and execute all pending callbacks immediately.
   */
  flushAll(): void;

  /**
   * Advance the timer by N milliseconds and flush callbacks whose delay has passed.
   */
  advanceAndFlush(ms: number, clock: FakeClock): void;
}

/**
 * Create a fake timer for testing.
 *
 * @returns Fake timer
 */
export function createFakeTimer(): FakeTimer {
  // TODO: implement timer that stores callbacks and executes them manually
  throw new Error("TODO");
}
