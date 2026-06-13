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
 * @param state Endpoint state
 * @param nowMs Current time
 * @returns Updated state with circuit closed if expired
 */
export function maybeCloseCircuit(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  if (!isCircuitOpen(state, nowMs)) {
    // Circuit not open or has expired
    return {
      ...state,
      circuitOpenUntil: undefined,
      consecutiveFailures: 0,
    };
  }
  return state;
}
