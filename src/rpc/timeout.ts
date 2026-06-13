/**
 * Timeout utilities.
 *
 * Functions to check if a request is within its timeout window,
 * and to wrap promises with timeout enforcement.
 */

import type { Timer } from "../core/timer";
import type { Clock } from "../core/clock";
import type { SdkError } from "../core/error";
import { createSdkError } from "../core/error";

/**
 * Check if a request is still within its timeout window.
 *
 * @param startedAtMs When the request started
 * @param nowMs Current time
 * @param timeoutMs Timeout duration (undefined = no timeout)
 * @returns true if still within timeout, false if exceeded
 */
export function isWithinTimeout(
  startedAtMs: number,
  nowMs: number,
  timeoutMs?: number,
): boolean {
  // TODO: if timeoutMs undefined return true, else check elapsed < timeoutMs
  throw new Error("TODO");
}

/**
 * Create a Timeout error.
 */
export function createTimeoutError(
  method: string,
  elapsedMs: number,
  timeoutMs: number,
): SdkError {
  return createSdkError(
    "Timeout",
    `RPC call to ${method} exceeded ${timeoutMs}ms timeout (elapsed: ${elapsedMs}ms)`,
    { retryable: true },
  );
}

/**
 * Wrap a promise with a timeout.
 *
 * @param promise Promise to wrap
 * @param timeoutMs Timeout duration
 * @param timer Timer to use for scheduling
 * @param clock Clock to use for calculating elapsed time
 * @param method Method name (for error message)
 * @returns Promise that rejects if timeout exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  timer: Timer,
  clock: Clock,
  method: string,
): Promise<T> {
  // TODO: if no timeout, return promise as-is;
  // else race with a timeout timer that rejects with createTimeoutError
  throw new Error("TODO");
}
