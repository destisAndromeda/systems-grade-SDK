/**
 * Fake timer for deterministic testing.
 *
 * Allows tests to schedule callbacks and execute them manually.
 */

import type { Timer } from "../core/timer.js";
import type { FakeClock } from "./fake-clock.js";

interface ScheduledCallback {
  id: number;
  fn: () => void;
  dueAt: number;
}

/**
 * Fake timer class for testing.
 */
export class FakeTimer implements Timer {
  private nextId: number = 1;
  private currentTime: number = 0;
  private scheduled: ScheduledCallback[] = [];
  private clock: FakeClock | undefined;

  constructor(clock?: FakeClock) {
    this.clock = clock;
  }

  /**
   * Schedule a callback to run after a delay.
   */
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    const dueAt = this.currentTime + ms;
    this.scheduled.push({ id, fn, dueAt });
    return id;
  }

  /**
   * Cancel a scheduled callback.
   */
  clearTimeout(handle: unknown): void {
    const id = handle as number;
    const index = this.scheduled.findIndex((cb) => cb.id === id);
    if (index >= 0) {
      this.scheduled.splice(index, 1);
    }
  }

  /**
   * Get the number of pending callbacks.
   */
  pendingCount(): number {
    return this.scheduled.length;
  }

  /**
   * Flush and execute all pending callbacks immediately.
   */
  flushAll(): void {
    // Execute all callbacks immediately, in order they were scheduled
    while (this.scheduled.length > 0) {
      const cb = this.scheduled.shift()!;
      cb.fn();
    }
  }

  /**
   * Async version of flushAll - executes all pending callbacks.
   */
  async flush(): Promise<void> {
    this.flushAll();
  }

  /**
   * Advance the timer by N milliseconds and flush callbacks whose delay has passed.
   */
  advanceAndFlush(ms: number, clock: FakeClock): void {
    this.currentTime += ms;
    clock.advance(ms);

    // Execute callbacks whose dueAt time has passed
    while (this.scheduled.length > 0) {
      const cb = this.scheduled[0];
      if (cb && cb.dueAt <= this.currentTime) {
        this.scheduled.shift();
        cb.fn();
      } else {
        break;
      }
    }
  }
}

/**
 * Create a fake timer for testing.
 *
 * @returns Fake timer
 */
export function createFakeTimer(): FakeTimer {
  return new FakeTimer();
}
