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
  // If success, don't retry
  if (result.kind === "success") {
    return false;
  }

  // If max attempts reached, don't retry
  if (attemptNumber >= config.maxAttempts) {
    return false;
  }

  // Otherwise, check if error is retryable
  return isRetryableSdkError(result.error);
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
  // Exponential backoff: baseDelay * 2^(attempt-1)
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attemptNumber - 1);

  // Cap at maxDelayMs
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: multiply by (1 ± jitterRatio * randomValue)
  const randomValue = random.next(); // [0, 1)
  const jitterMultiplier = 1 + (randomValue - 0.5) * 2 * config.jitterRatio;
  const delayWithJitter = cappedDelay * jitterMultiplier;

  // Ensure non-negative
  return Math.max(0, delayWithJitter);
}
