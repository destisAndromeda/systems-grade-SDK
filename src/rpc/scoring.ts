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
  let score = 0;

  // Latency score (weighted by config)
  score += state.avgLatencyMs * config.latencyWeight;

  // Failure rate score (weighted by config)
  const totalAttempts = state.successCount + state.failureCount;
  const failureRate = totalAttempts > 0 ? state.failureCount / totalAttempts : 0;
  score += failureRate * 1000 * config.failureWeight; // Scale to reasonable range

  // Recent failure penalty (if last failure was recent)
  if (state.lastFailureAt !== undefined) {
    const timeSinceFailureMs = nowMs - state.lastFailureAt;
    // Penalty decays over time (exponential decay)
    const recencyFactor = Math.exp(-timeSinceFailureMs / 10000); // 10s half-life
    score += recencyFactor * config.recentFailurePenalty;
  }

  return score;
}

/**
 * Check if endpoint circuit is currently open.
 */
export function isEndpointCircuitOpen(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  return state.circuitOpenUntil !== undefined && state.circuitOpenUntil > nowMs;
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
  // Filter out circuit-open endpoints
  const available = states.filter((state) => !isEndpointCircuitOpen(state, nowMs));

  if (available.length === 0) {
    return err(createSdkError("AllEndpointsFailed", "All RPC endpoints are circuit-open"));
  }

  // Score each available endpoint and select the best (lowest score)
  let bestEndpoint = available[0];
  let bestScore = scoreEndpoint(bestEndpoint, config, nowMs);

  for (let i = 1; i < available.length; i++) {
    const score = scoreEndpoint(available[i], config, nowMs);
    if (score < bestScore) {
      bestScore = score;
      bestEndpoint = available[i];
    }
  }

  return ok(bestEndpoint);
}
