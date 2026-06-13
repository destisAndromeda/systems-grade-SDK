/**
 * Timeout utilities.
 *
 * Functions to check if a request is within its timeout window,
 * and to wrap promises with timeout enforcement.
 */

import type { Timer } from "../core/timer.js";
import type { Clock } from "../core/clock.js";
import type { SdkError } from "../core/error.js";
import { createSdkError } from "../core/error.js";

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
  if (timeoutMs === undefined) {
    return true;
  }
  return nowMs - startedAtMs <= timeoutMs;
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
  if (timeoutMs === undefined) {
    return promise;
  }

  const startedAtMs = clock.now();

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timeoutHandle = timer.setTimeout(() => {
      if (settled) return;
      settled = true;
      const elapsedMs = clock.now() - startedAtMs;
      reject(createTimeoutError(method, elapsedMs, timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        timer.clearTimeout(timeoutHandle);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        timer.clearTimeout(timeoutHandle);
        reject(error);
      },
    );
  });
}
