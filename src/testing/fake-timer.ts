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
  interface ScheduledCallback {
    id: number;
    fn: () => void;
    dueAt: number;
  }

  let nextId = 1;
  let currentTime = 0;
  const scheduled: ScheduledCallback[] = [];

  return {
    setTimeout(fn: () => void, ms: number): unknown {
      const id = nextId++;
      const dueAt = currentTime + ms;
      scheduled.push({ id, fn, dueAt });
      return id;
    },

    clearTimeout(handle: unknown): void {
      const id = handle as number;
      const index = scheduled.findIndex((cb) => cb.id === id);
      if (index >= 0) {
        scheduled.splice(index, 1);
      }
    },

    pendingCount(): number {
      return scheduled.length;
    },

    flushAll(): void {
      // Execute all callbacks immediately, in order they were scheduled
      while (scheduled.length > 0) {
        const cb = scheduled.shift()!;
        cb.fn();
      }
    },

    advanceAndFlush(ms: number, clock: FakeClock): void {
      currentTime += ms;
      clock.advance(ms);

      // Execute callbacks whose dueAt time has passed
      while (scheduled.length > 0) {
        const cb = scheduled[0];
        if (cb && cb.dueAt <= currentTime) {
          scheduled.shift();
          cb.fn();
        } else {
          break;
        }
      }
    },
  };
}
