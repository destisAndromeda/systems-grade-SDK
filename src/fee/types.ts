/**
 * Priority fee types.
 *
 * Data structures for fee estimation providers.
 */

import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";

/**
 * Priority fee estimate.
 */
export interface PriorityFeeEstimate {
  priorityFeeMicroLamports: number;
  source: string; // e.g. "static", "rpc", "fallback"
  fetchedAtMs: number; // When this estimate was fetched
}

/**
 * Provider of priority fee estimates.
 */
export interface PriorityFeeProvider {
  readonly name: string;

  /**
   * Get a priority fee estimate.
   *
   * @param nowMs Current time for staleness checking
   * @returns Fee estimate or error
   */
  getEstimate(nowMs: number): Promise<Result<PriorityFeeEstimate, SdkError>>;
}

/**
 * Configuration for priority fee handling.
 */
export interface PriorityFeeConfig {
  maxStaleMs: number; // Max age of estimate before considered stale (e.g. 30000 = 30s)
  fallbackMicroLamports: number; // Default fee if all providers fail (e.g. 100)
}
