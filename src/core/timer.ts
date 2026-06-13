/**
 * Timer interface and implementations.
 *
 * Abstracts scheduling so tests can deterministically control async behavior.
 * All delays and timeouts in the SDK use injected Timer.
 */

/**
 * Timer interface for scheduling callbacks.
 */
export interface Timer {
  /**
   * Schedule a callback to run after a delay (in milliseconds).
   * Returns a handle that can be passed to clearTimeout.
   */
  setTimeout(fn: () => void, ms: number): unknown;

  /**
   * Cancel a scheduled callback by its handle.
   */
  clearTimeout(handle: unknown): void;
}

/**
 * Create a system timer using native setTimeout/clearTimeout.
 */
export function createSystemTimer(): Timer {
  return {
    setTimeout(fn: () => void, ms: number): unknown {
      return setTimeout(fn, ms);
    },
    clearTimeout(handle: unknown): void {
      clearTimeout(handle as NodeJS.Timeout | number);
    },
  };
}
