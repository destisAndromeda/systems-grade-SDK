/**
 * Circuit breaker logic.
 *
 * Functions to determine when to open/close circuit for an endpoint,
 * preventing repeated requests to a failing endpoint.
 */

import type { RpcEndpointState, CircuitBreakerConfig } from "./types.js";

/**
 * Check if an endpoint's circuit should be opened.
 *
 * Opens when consecutive failures reach the threshold.
 *
 * @param state Endpoint state
 * @param config Circuit breaker configuration
 * @returns true if circuit should be opened
 */
export function shouldOpenCircuit(
  state: RpcEndpointState,
  config: CircuitBreakerConfig,
): boolean {
  return state.consecutiveFailures >= config.failureThreshold;
}

/**
 * Open a circuit for an endpoint.
 *
 * @param state Endpoint state
 * @param nowMs Current time
 * @param openDurationMs How long to keep circuit open
 * @returns Updated state with circuit open
 */
export function openCircuit(
  state: RpcEndpointState,
  nowMs: number,
  openDurationMs: number,
): RpcEndpointState {
  return {
    ...state,
    circuitOpenUntil: nowMs + openDurationMs,
  };
}

/**
 * Check if a circuit is currently open.
 *
 * @param state Endpoint state
 * @param nowMs Current time
 * @returns true if circuit is open
 */
export function isCircuitOpen(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  return state.circuitOpenUntil !== undefined && state.circuitOpenUntil > nowMs;
}

/**
 * Maybe close a circuit if it has expired.
 *
 * Only resets the circuit and consecutive failures if:
 * - Circuit was previously opened (circuitOpenUntil is defined)
 * - AND the circuit duration has expired (circuitOpenUntil <= nowMs)
 *
 * @param state Endpoint state
 * @param nowMs Current time
 * @returns Updated state with circuit closed if expired, otherwise unchanged
 */
export function maybeCloseCircuit(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  // Only reset if circuit was previously opened AND it has now expired
  if (
    state.circuitOpenUntil !== undefined &&
    state.circuitOpenUntil <= nowMs
  ) {
    // Circuit was open but has now expired - reset it
    const { circuitOpenUntil: _, ...rest } = state;
    return {
      ...rest,
      consecutiveFailures: 0,
    };
  }
  // Circuit never opened, still open, or not ready to close yet - return unchanged
  return state;
}
