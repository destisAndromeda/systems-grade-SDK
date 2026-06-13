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
  const config: RpcEndpointConfig = typeof input === "string" ? { url: input } : input;

  // Fill defaults
  if (!config.weight) {
    config.weight = 1;
  }

  // Validate URL
  if (!config.url || config.url.trim() === "") {
    return err(createSdkError("InvalidConfig", "Endpoint URL cannot be empty"));
  }

  try {
    new URL(config.url);
  } catch {
    return err(createSdkError("InvalidConfig", `Invalid URL: ${config.url}`));
  }

  return ok(config);
}

/**
 * Create a stable unique ID for an endpoint.
 * Same URL should produce same ID (normalized, trailing slash removed).
 */
export function createEndpointId(config: RpcEndpointConfig): string {
  // Normalize: remove trailing slash and lowercase
  const normalized = config.url.replace(/\/$/, "").toLowerCase();
  // Simple slug: replace special chars with underscore
  return normalized
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Create initial endpoint state from config.
 * Called when a new endpoint is added to the registry.
 */
export function createInitialEndpointState(config: RpcEndpointConfig): RpcEndpointState {
  return {
    config,
    id: createEndpointId(config),
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    avgLatencyMs: 0,
  };
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
  const successCount = state.successCount + 1;
  // Exponential moving average: new_avg = (old_avg * old_count + new_latency) / new_count
  const avgLatencyMs =
    (state.avgLatencyMs * state.successCount + latencyMs) / successCount;

  return {
    ...state,
    successCount,
    failureCount: state.failureCount,
    consecutiveFailures: 0,
    avgLatencyMs,
    lastSuccessAt: nowMs,
  };
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
  return {
    ...state,
    failureCount: state.failureCount + 1,
    consecutiveFailures: state.consecutiveFailures + 1,
    lastFailureAt: nowMs,
  };
}

/**
 * Apply a request outcome (success or failure) to endpoint state.
 */
export function applyEndpointAttemptOutcome(
  state: RpcEndpointState,
  outcome: EndpointAttemptOutcome,
  nowMs: number,
): RpcEndpointState {
  if (outcome.success) {
    return recordEndpointSuccess(state, outcome.latencyMs, nowMs);
  } else {
    return recordEndpointFailure(state, outcome.error!, nowMs);
  }
}

/**
 * Check if an endpoint is healthy (not circuit-open, reasonable stats).
 */
export function isEndpointHealthy(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  // Endpoint is healthy if circuit is not open
  // Note: circuit status is checked in scoring/selection logic
  return !state.circuitOpenUntil || state.circuitOpenUntil <= nowMs;
}
