/**
 * Priority fee types.
 *
 * Data structures for fee estimation providers.
 */

/**
 * Priority fee estimate.
 */
export interface PriorityFeeEstimate {
  priorityFeeMicroLamports: number;
  source: string; // e.g. "helius", "static", "rpc"
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
  getEstimate(nowMs: number): Promise<PriorityFeeEstimate>;
}

/**
 * Configuration for priority fee handling.
 */
export interface PriorityFeeConfig {
  maxStaleMs: number; // Max age of estimate before considered stale (e.g. 30000 = 30s)
  fallbackMicroLamports: number; // Default fee if all providers fail (e.g. 100)
}
