/**
 * Retry logic and backoff computation.
 *
 * Functions to determine whether to retry a failed request,
 * and to compute exponential backoff delays with jitter.
 */

import type { RetryConfig } from "./types.js";
import type { RpcAttemptResult } from "./types.js";
import type { RandomSource } from "../core/random.js";
import { isRetryableSdkError } from "../core/error.js";

/**
 * Determine if a request should be retried.
 *
 * Returns false if:
 *  - attempt succeeded
 *  - max attempts reached
 *  - error is not retryable
 * Returns true if error is retryable and attempts remain.
 */
export function shouldRetry(
  result: RpcAttemptResult<unknown>,
  attemptNumber: number, // 1-based
  config: RetryConfig,
): boolean {
  // TODO: check result kind, return false if success,
  // false if attemptNumber >= maxAttempts,
  // else check isRetryableSdkError(result.error)
  throw new Error("TODO");
}

/**
 * Compute backoff delay with exponential growth and jitter.
 *
 * Formula: baseDelayMs * 2^(attempt-1) * (1 ± jitterRatio * random)
 * Capped at maxDelayMs, never negative.
 *
 * @param attemptNumber 1-based attempt number
 * @param config Retry configuration
 * @param random Random source for jitter
 * @returns Delay in milliseconds
 */
export function computeBackoffMs(
  attemptNumber: number,
  config: RetryConfig,
  random: RandomSource,
): number {
  // TODO: compute exponential backoff with jitter, cap at maxDelayMs
  throw new Error("TODO");
}
