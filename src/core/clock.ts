/**
 * Clock interface and implementations.
 *
 * Abstracts time source so tests can control time deterministically.
 * All time-sensitive logic in the SDK takes a Clock dependency.
 */

/**
 * Time source interface.
 * All times are in milliseconds since epoch (Date.now() compatible).
 */
export interface Clock {
  /**
   * Get current time in milliseconds since epoch.
   */
  now(): number;
}

/**
 * Create a system clock that reads from Date.now().
 */
export function createSystemClock(): Clock {
  return {
    now(): number {
      return Date.now();
    },
  };
}
