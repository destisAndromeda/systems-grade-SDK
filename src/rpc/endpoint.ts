/**
 * RPC endpoint utilities.
 *
 * Functions for normalizing endpoint configs, creating stable IDs,
 * initializing endpoint state, and recording success/failure outcomes.
 */

import type { RpcEndpointConfig, RpcEndpointState, EndpointAttemptOutcome } from "./types.js";
import { getCircuitState } from "./circuit-breaker.js";
import type { SdkError } from "../core/error.js";
import { err, ok, type Result } from "../core/result.js";
import { createSdkError } from "../core/error.js";

/**
 * Normalize endpoint config from string or object.
 * Applied before adding to registry.
 * Does not mutate the input object.
 */
export function normalizeRpcEndpointConfig(
  input: string | RpcEndpointConfig,
): Result<RpcEndpointConfig, SdkError> {
  // Create a new config object to avoid mutation
  const inputConfig = typeof input === "string" ? { url: input } : input;
  const config: RpcEndpointConfig = {
    url: inputConfig.url,
    weight: inputConfig.weight ?? 1,
  };

  if (inputConfig.timeoutMs !== undefined) {
    config.timeoutMs = inputConfig.timeoutMs;
  }

  if (inputConfig.headers !== undefined) {
    config.headers = inputConfig.headers;
  }

  // Validate URL
  if (!config.url || config.url.trim() === "") {
    return err(createSdkError("InvalidConfig", "Endpoint URL cannot be empty"));
  }

  try {
    const urlObj = new URL(config.url);
    // Normalize: remove trailing slash
    config.url = urlObj.href.replace(/\/$/, "");
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
    circuitState: "closed",
    circuitCooldownMs: config.circuitCooldownMs ?? 1_000,
    inFlightCount: 0,
    slotLag: 0,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { circuitOpenedAt: _oa, circuitOpenUntil: _ou, ...rest } = state;
  return {
    ...rest,
    successCount,
    consecutiveFailures: 0,
    avgLatencyMs,
    lastSuccessAt: nowMs,
    circuitState: "closed" as const,
    circuitCooldownMs: state.config.circuitCooldownMs ?? 1_000,
  };
}

/**
 * Record an attempt failure (increments consecutive failures for circuit breaker).
 * Does NOT increment overall failureCount (only recordRequestFailure does that).
 */
export function recordAttemptFailure(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  return {
    ...state,
    consecutiveFailures: state.consecutiveFailures + 1,
    lastFailureAt: nowMs,
  };
}

/**
 * Record a request-level failure (increments overall failure count).
 */
export function recordRequestFailure(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  return {
    ...state,
    failureCount: state.failureCount + 1,
    lastFailureAt: nowMs,
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
  // Endpoint is healthy if circuit is closed or half-open (ready for a probe)
  const circuitState = getCircuitState(state, nowMs);
  return circuitState !== "open";
}
