/**
 * RPC endpoint utilities.
 *
 * Functions for normalizing endpoint configs, creating stable IDs,
 * initializing endpoint state, and recording success/failure outcomes.
 */

import type { RpcEndpointConfig, RpcEndpointState, EndpointAttemptOutcome } from "./types.js";
import type { SdkError } from "../core/error.js";
import { err, ok, type Result } from "../core/result.js";
import { createSdkError } from "../core/error.js";

/**
 * Normalize endpoint config from string or object.
 * Applied before adding to registry.
 */
export function normalizeRpcEndpointConfig(
  input: string | RpcEndpointConfig,
): Result<RpcEndpointConfig> {
  // TODO: convert string to {url, weight:1}, fill defaults, validate URL, return ok/err
  throw new Error("TODO");
}

/**
 * Create a stable unique ID for an endpoint.
 * Same URL should produce same ID (normalized, trailing slash removed).
 */
export function createEndpointId(config: RpcEndpointConfig): string {
  // TODO: hash or slug the URL to create stable ID
  throw new Error("TODO");
}

/**
 * Create initial endpoint state from config.
 * Called when a new endpoint is added to the registry.
 */
export function createInitialEndpointState(config: RpcEndpointConfig): RpcEndpointState {
  // TODO: initialize counters to zero, set config and id
  throw new Error("TODO");
}

/**
 * Record a successful RPC attempt.
 * Updates latency average, resets failure counter, sets lastSuccessAt.
 */
export function recordEndpointSuccess(
  state: RpcEndpointState,
  latencyMs: number,
  nowMs: number,
): RpcEndpointState {
  // TODO: increment successCount, update avgLatencyMs via exponential moving average,
  // reset consecutiveFailures, set lastSuccessAt
  throw new Error("TODO");
}

/**
 * Record a failed RPC attempt.
 * Updates failure counters and tracking timestamps.
 */
export function recordEndpointFailure(
  state: RpcEndpointState,
  error: SdkError,
  nowMs: number,
): RpcEndpointState {
  // TODO: increment failureCount and consecutiveFailures, set lastFailureAt
  throw new Error("TODO");
}

/**
 * Apply a request outcome (success or failure) to endpoint state.
 */
export function applyEndpointAttemptOutcome(
  state: RpcEndpointState,
  outcome: EndpointAttemptOutcome,
  nowMs: number,
): RpcEndpointState {
  // TODO: dispatch to recordEndpointSuccess or recordEndpointFailure based on outcome.success
  throw new Error("TODO");
}

/**
 * Check if an endpoint is healthy (not circuit-open, reasonable stats).
 */
export function isEndpointHealthy(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  // TODO: return true if circuit is not open and endpoint has reasonable health
  throw new Error("TODO");
}
