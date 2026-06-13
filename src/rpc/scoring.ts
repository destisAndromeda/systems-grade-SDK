/**
 * Endpoint scoring and selection.
 *
 * Functions to score endpoints based on latency, success rate, and circuit state.
 * Used to intelligently select the best available endpoint for each request.
 */

import type { RpcEndpointState, EndpointScoreConfig } from "./types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError } from "../core/error.js";

/**
 * Score an endpoint (lower is better).
 *
 * Combines latency, failure rate, and recent failure penalty.
 * Higher latency and more failures = higher (worse) score.
 *
 * @param state Endpoint state to score
 * @param config Scoring weights
 * @param nowMs Current time for recency calculations
 * @returns Score (lower is better)
 */
export function scoreEndpoint(
  state: RpcEndpointState,
  config: EndpointScoreConfig,
  nowMs: number,
): number {
  // TODO: calculate score combining latency, failure rate, and recency penalties
  // lower is better; zero-attempt endpoint should get neutral/high score
  throw new Error("TODO");
}

/**
 * Check if endpoint circuit is currently open.
 */
export function isEndpointCircuitOpen(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  // TODO: return true if circuitOpenUntil is set and > nowMs
  throw new Error("TODO");
}

/**
 * Select the best available endpoint from a list.
 *
 * Excludes circuit-open endpoints and picks the one with lowest score.
 *
 * @param states Available endpoint states
 * @param config Scoring configuration
 * @param nowMs Current time
 * @returns Selected endpoint or error if all are circuit-open
 */
export function selectBestEndpoint(
  states: RpcEndpointState[],
  config: EndpointScoreConfig,
  nowMs: number,
): Result<RpcEndpointState> {
  // TODO: filter out circuit-open endpoints, score remaining ones,
  // return one with lowest score or err(AllEndpointsFailed)
  throw new Error("TODO");
}
