import type { RpcEndpointState, CircuitBreakerConfig, CircuitState } from "./types.js";

/**
 * Get the current circuit state, transitioning to half_open if cooldown has elapsed.
 */
export function getCircuitState(
  state: RpcEndpointState,
  nowMs: number,
): CircuitState {
  if (state.circuitState === "open") {
    const openedAt = state.circuitOpenedAt ?? 0;
    if (nowMs >= openedAt + state.circuitCooldownMs) {
      return "half_open";
    }
    return "open";
  }
  // Legacy compatibility: check circuitOpenUntil if circuitState is not explicitly "open"
  if (state.circuitOpenUntil !== undefined && state.circuitOpenUntil > nowMs) {
    return "open";
  }
  return state.circuitState;
}

/**
 * Check if a request should be allowed (closed or half_open).
 */
export function shouldAllowRequest(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  const current = getCircuitState(state, nowMs);
  return current === "closed" || current === "half_open";
}

/**
 * Trip the circuit (transition to open state) with exponential backoff.
 */
export function tripCircuit(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  const isReopen = state.circuitState === "half_open" || getCircuitState(state, nowMs) === "half_open";
  const nextCooldown = isReopen ? Math.min(30_000, state.circuitCooldownMs * 2) : state.circuitCooldownMs;
  return {
    ...state,
    circuitState: "open",
    circuitOpenedAt: nowMs,
    circuitOpenUntil: nowMs + nextCooldown,
    circuitCooldownMs: nextCooldown,
  };
}

/**
 * Record a circuit success, closing the circuit.
 */
export function recordCircuitSuccess(
  state: RpcEndpointState,
): RpcEndpointState {
   
  const { circuitOpenedAt: _oa, circuitOpenUntil: _ou, ...rest } = state;
  return {
    ...rest,
    circuitState: "closed",
    consecutiveFailures: 0,
    circuitCooldownMs: state.config.circuitCooldownMs ?? 1_000,
  };
}

/**
 * Record a circuit failure. If in half_open, immediately trips the circuit.
 */
export function recordCircuitFailure(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  const consecutiveFailures = state.consecutiveFailures + 1;
  const failureState = {
    ...state,
    consecutiveFailures,
    lastFailureAt: nowMs,
  };
  if (state.circuitState === "half_open" || getCircuitState(state, nowMs) === "half_open") {
    return tripCircuit(failureState, nowMs);
  }
  return failureState;
}

/**
 * Check if an endpoint's circuit should be opened.
 *
 * Opens when consecutive failures reach the threshold, or if in half-open state.
 */
export function shouldOpenCircuit(
  state: RpcEndpointState,
  config: CircuitBreakerConfig,
): boolean {
  return state.circuitState === "half_open" || state.consecutiveFailures >= config.failureThreshold;
}

/**
 * Open a circuit for an endpoint.
 */
export function openCircuit(
  state: RpcEndpointState,
  nowMs: number,
  openDurationMs: number,
): RpcEndpointState {
  const isReopen = state.circuitState === "half_open" || getCircuitState(state, nowMs) === "half_open";
  const nextCooldown = isReopen ? Math.min(30_000, state.circuitCooldownMs * 2) : openDurationMs;
  return {
    ...state,
    circuitState: "open",
    circuitOpenedAt: nowMs,
    circuitOpenUntil: nowMs + nextCooldown,
    circuitCooldownMs: nextCooldown,
  };
}

/**
 * Check if a circuit is currently open.
 */
export function isCircuitOpen(
  state: RpcEndpointState,
  nowMs: number,
): boolean {
  return getCircuitState(state, nowMs) === "open";
}

/**
 * Maybe close a circuit if it has expired.
 */
export function maybeCloseCircuit(
  state: RpcEndpointState,
  nowMs: number,
): RpcEndpointState {
  if (state.circuitOpenUntil !== undefined && state.circuitOpenUntil <= nowMs) {
     
    const { circuitOpenUntil: _ou, ...rest } = state;
    if (state.circuitState === "open") {
      return {
        ...rest,
        circuitState: "half_open" as const,
      };
    } else {
      return {
        ...rest,
        circuitState: "closed" as const,
        consecutiveFailures: 0,
        circuitCooldownMs: state.config.circuitCooldownMs ?? 1_000,
      };
    }
  }
  return state;
}
