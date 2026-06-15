/**
 * RPC types and interfaces.
 *
 * Core data structures for endpoint configuration, state tracking, transport abstraction,
 * and resilience policies (retry, circuit breaker, timeout).
 */

import type { SdkError } from "../core/error.js";

export type CircuitState = "closed" | "open" | "half_open";

/**
 * Configuration for a single RPC endpoint.
 * Used by registry and transport creation.
 */
export interface RpcEndpointConfig {
  url: string;
  weight?: number; // Load balancing weight (default: 1)
  timeoutMs?: number; // Timeout for calls to this endpoint
  headers?: Record<string, string>; // Custom HTTP headers
  circuitCooldownMs?: number; // Cooldown duration for circuit breaker
}

/**
 * Runtime state tracking for a single RPC endpoint.
 * Updated as requests succeed or fail.
 */
export interface RpcEndpointState {
  config: RpcEndpointConfig;
  id: string; // Stable unique ID for this endpoint

  // Health tracking
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;

  // Circuit breaker
  circuitOpenUntil?: number; // If set and > now(), circuit is open
  circuitState: CircuitState;
  circuitOpenedAt?: number;
  circuitCooldownMs: number;
  inFlightCount: number;
  slotLag: number;
  lastObservedSlot?: number;
}

/**
 * Registry of RPC endpoints with their current state.
 */
export interface EndpointRegistry {
  getAll(): RpcEndpointState[];
  getById(id: string): RpcEndpointState | undefined;
  upsert(state: RpcEndpointState): void;
}

/**
 * RPC transport abstraction.
 * Implementations wrap actual RPC clients (kit, viem, etc.) or fake transports for testing.
 */
export interface RpcTransport {
  readonly endpointUrl: string;
  readonly endpointId: string;

  send<TParams, TResult>(
    method: string,
    params: TParams,
    options?: { timeoutMs?: number },
  ): Promise<TResult>;
}

/**
 * Context for a single RPC request.
 * Tracks timing and parameters for retry/timeout logic.
 */
export interface RpcRequestContext<TParams = unknown> {
  method: string;
  params: TParams;
  timeoutMs?: number;
  startedAtMs: number; // When the request started (for timeout calculation)
}

/**
 * Result of a single RPC attempt (success or failure).
 */
export type RpcAttemptResult<T> =
  | {
      kind: "success";
      value: T;
      latencyMs: number;
      endpointId: string;
    }
  | {
      kind: "failure";
      error: SdkError;
      latencyMs: number;
      endpointId: string;
    };

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  maxAttempts: number; // Max number of attempts (e.g. 3)
  baseDelayMs: number; // Initial backoff delay (e.g. 100)
  maxDelayMs: number; // Cap on backoff delay (e.g. 5000)
  jitterRatio: number; // Random jitter ratio [0, 1] (e.g. 0.1 = ±10%)
}

/**
 * Configuration for circuit breaker (endpoint health management).
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Consecutive failures before opening (e.g. 3)
  openDurationMs: number; // How long circuit stays open (e.g. 30000 = 30s)
}

/**
 * Configuration for endpoint scoring and selection.
 */
export interface EndpointScoreConfig {
  latencyWeight: number; // Weight for latency in score calculation
  failureWeight: number; // Weight for failure rate
  recentFailurePenalty: number; // Extra penalty for recent failures
}

/**
 * Complete resilient RPC configuration.
 */
export interface ResilientRpcConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  scoring: EndpointScoreConfig;
  defaultTimeoutMs?: number; // Default timeout if not set per-endpoint
}

/**
 * Result of a resilient RPC request.
 */
export type ResilientRpcResult<T> = {
  value: T;
  endpointId: string;
  attempts: number;
  latencyMs: number;
};

/**
 * Outcome of a single endpoint attempt (for recording).
 */
export interface EndpointAttemptOutcome {
  endpointId: string;
  success: boolean;
  latencyMs: number;
  error?: SdkError;
}
