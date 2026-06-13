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
  // TODO: return true if consecutiveFailures >= failureThreshold
  throw new Error("TODO");
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
  // TODO: set circuitOpenUntil = nowMs + openDurationMs
  throw new Error("TODO");
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
  // TODO: return true if circuitOpenUntil is set and > nowMs
  throw new Error("TODO");
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
  // TODO: if circuit is open but circuitOpenUntil <= nowMs,
  // clear circuitOpenUntil and reset consecutiveFailures to 0
  throw new Error("TODO");
}
