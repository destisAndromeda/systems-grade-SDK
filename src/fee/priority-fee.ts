/**
 * Priority fee utilities.
 *
 * Functions to create fee providers, check staleness,
 * and get priority fee estimates.
 */

import type { PriorityFeeEstimate, PriorityFeeProvider, PriorityFeeConfig } from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Clock } from "../core/clock.js";

/**
 * Create a static priority fee provider.
 *
 * Returns a fixed fee estimate regardless of network conditions.
 *
 * @param estimate Fee estimate value
 * @param clock Clock for timestamping
 * @returns Fee provider
 */
export function createStaticPriorityFeeProvider(
  estimate: number,
  clock: Clock,
): PriorityFeeProvider {
  // TODO: create provider that always returns the same estimate with current timestamp
  throw new Error("TODO");
}

/**
 * Create a priority fee provider from RPC.
 *
 * Queries the RPC endpoint for current fee estimates.
 *
 * @param transport RPC transport
 * @param clock Clock for timestamping
 * @returns Fee provider
 */
export function createRpcPriorityFeeProvider(
  transport: RpcTransport,
  clock: Clock,
): PriorityFeeProvider {
  // TODO: create provider that calls RPC to get current fees
  throw new Error("TODO");
}

/**
 * Check if a fee estimate is stale.
 *
 * @param estimate Fee estimate
 * @param nowMs Current time
 * @param maxStaleMs Max age before considered stale
 * @returns true if estimate is too old
 */
export function isPriorityFeeStale(
  estimate: PriorityFeeEstimate,
  nowMs: number,
  maxStaleMs: number,
): boolean {
  // TODO: return true if (nowMs - estimate.fetchedAtMs) > maxStaleMs
  throw new Error("TODO");
}

/**
 * Get priority fee estimate from a list of providers.
 *
 * Returns the first non-stale estimate, or fallback if all fail/are stale.
 *
 * @param providers Fee providers to query
 * @param config Fee configuration
 * @param clock Clock for staleness checking
 * @returns Fee estimate
 */
export async function getPriorityFeeEstimate(
  providers: PriorityFeeProvider[],
  config: PriorityFeeConfig,
  clock: Clock,
): Promise<PriorityFeeEstimate> {
  // TODO: query providers in sequence, return first non-stale result or fallback
  throw new Error("TODO");
}
