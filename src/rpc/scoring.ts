/**
 * Endpoint scoring and selection.
 *
 * Functions to score endpoints based on latency, success rate, and circuit state.
 * Used to intelligently select the best available endpoint for each request.
 */

import type { RpcEndpointState, EndpointScoreConfig } from "./types.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";
import { ok, err } from "../core/result.js";
import { createSdkError } from "../core/error.js";
import { isCircuitOpen } from "./circuit-breaker.js";

/**
 * Score an endpoint (lower is better).
 *
 * Combines latency, failure rate, recent failure penalty, in-flight load penalty, and slot lag penalty.
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

  // Phase 2.3 — in-flight load penalty: each concurrent request adds a latency-equivalent penalty
  // Uses the config latencyWeight so the penalty is on the same scale as latency score
  const loadPenaltyMs = (state.inFlightCount ?? 0) * 50; // 50 ms equivalent per concurrent request
  score += loadPenaltyMs * config.latencyWeight;

  // Phase 2.5 — slot-lag penalty: penalise endpoints that are behind the cluster head slot.
  // Each slot of lag adds a small latency-equivalent penalty (1 slot ≈ 400 ms on Solana mainnet).
  const slotLagPenaltyMs = (state.slotLag ?? 0) * 10; // 10 ms equivalent per slot of lag
  score += slotLagPenaltyMs * config.latencyWeight;

  return score;
}

/**
 * Check if endpoint circuit is currently open.
 */
export function isEndpointCircuitOpen(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  return isCircuitOpen(state, nowMs);
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
): Result<RpcEndpointState, SdkError> {
  // Filter out circuit-open endpoints
  const available = states.filter((state) => !isEndpointCircuitOpen(state, nowMs));

  if (available.length === 0) {
    return err(createSdkError("AllEndpointsFailed", "All RPC endpoints are circuit-open"));
  }

  // Score each available endpoint and select the best (lowest score)
  const firstEndpoint = available[0];
  if (!firstEndpoint) {
    return err(createSdkError("AllEndpointsFailed", "All RPC endpoints are circuit-open"));
  }

  let bestEndpoint = firstEndpoint;
  let bestScore = scoreEndpoint(bestEndpoint, config, nowMs);

  for (let i = 1; i < available.length; i++) {
    const endpoint = available[i];
    if (endpoint) {
      const score = scoreEndpoint(endpoint, config, nowMs);
      if (score < bestScore) {
        bestScore = score;
        bestEndpoint = endpoint;
      }
    }
  }

  return ok(bestEndpoint);
}
