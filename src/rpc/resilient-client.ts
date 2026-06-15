/**
 * Resilient RPC client.
 *
 * Combines endpoint selection, retry logic, circuit breaker, and timeout
 * into a single request execution flow.
 *
 * Flow:
 *  1. Select best available endpoint
 *  2. Execute RPC attempt
 *  3. Record success/failure to endpoint state
 *  4. If failed and retryable and attempts remain, retry with backoff
 *  5. Try next endpoint if current one fails
 *  6. Return final result
 */

import type { RpcTransport, ResilientRpcConfig, ResilientRpcResult } from "./types.js";
import type { EndpointRegistry } from "./types.js";
import type { Clock } from "../core/clock.js";
import type { Timer } from "../core/timer.js";
import type { RandomSource } from "../core/random.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError, isRetryableSdkError } from "../core/error.js";
import { selectBestEndpoint } from "./scoring.js";
import { recordEndpointSuccess, recordAttemptFailure, recordRequestFailure } from "./endpoint.js";
import { shouldOpenCircuit, openCircuit, maybeCloseCircuit } from "./circuit-breaker.js";
import { shouldRetry, computeBackoffMs } from "./retry.js";
import { createRpcRequestContext, executeRpcAttempt } from "./transport.js";
import { classifyError, isEndpointFault } from "./error-classifier.js";

/**
 * Dependencies for resilient RPC client.
 */
export interface ResilientRpcClientDeps {
  registry: EndpointRegistry;
  clock: Clock;
  timer: Timer;
  random: RandomSource;
}

/**
 * Create a resilient RPC transport that combines retry, circuit breaker, and endpoint selection.
 *
 * @param transports Factory to create transport for each endpoint
 * @param config Resilience configuration
 * @param deps Injected dependencies (registry, clock, timer, random)
 * @returns RpcTransport that wraps resilience logic
 */
export function createResilientRpcClient(
  transports: Map<string, RpcTransport>, // endpointId -> transport
  config: ResilientRpcConfig,
  deps: ResilientRpcClientDeps,
): RpcTransport {
  return {
    endpointUrl: "resilient://rpc",
    endpointId: "resilient-rpc",

    async send<TParams, TResult>(
      method: string,
      params: TParams,
      options?: { timeoutMs?: number },
    ): Promise<TResult> {
      const result = await executeResilientRpcRequest<TParams, TResult>(method, params, transports, config, deps);

      if (result.ok) {
        return result.value.value as TResult;
      } else {
        throw result.error;
      }
    },
  };
}

/**
 * Execute a single RPC request with resilience (retry, circuit breaker, fallback).
 *
 * @param method RPC method name
 * @param params Method parameters
 * @param transports Map of endpoint ID to transport
 * @param config Resilience configuration
 * @param deps Injected dependencies
 * @returns Result with value or error
 */
export async function executeResilientRpcRequest<TParams, TResult>(
  method: string,
  params: TParams,
  transports: Map<string, RpcTransport>,
  config: ResilientRpcConfig,
  deps: ResilientRpcClientDeps,
): Promise<Result<ResilientRpcResult<TResult>>> {
  let attempts = 0;
  let totalLatencyMs = 0;
  let lastError: Error | undefined;
  let lastAttemptedEndpointId: string | undefined;
  let hitMaxRetries = false;

  const startedAtMs = deps.clock.now();
  const initialEndpointCount = deps.registry.getAll().length;

  // Keep trying until max attempts
  while (attempts < config.retry.maxAttempts) {
    attempts++;

    // Run maybeCloseCircuit on all endpoints
    const allStates = deps.registry.getAll();
    const nowMs = deps.clock.now();
    for (const state of allStates) {
      const closedState = maybeCloseCircuit(state, nowMs);
      deps.registry.upsert(closedState);
    }

    // Select best endpoint
    const selectResult = selectBestEndpoint(
      deps.registry.getAll(),
      config.scoring,
      nowMs,
    );

    if (!selectResult.ok) {
      return err(selectResult.error);
    }

    const selectedState = selectResult.value;
    
    // If we switched to a different endpoint, record request failure on previous one
    if (lastAttemptedEndpointId && lastAttemptedEndpointId !== selectedState.id) {
      const prevState = deps.registry.getById(lastAttemptedEndpointId);
      if (prevState) {
        const prevFailedState = recordRequestFailure(prevState, nowMs);
        deps.registry.upsert(prevFailedState);
      }
    }
    lastAttemptedEndpointId = selectedState.id;

    const transport = transports.get(selectedState.id);

    // If transport not found, treat as endpoint failure
    if (!transport) {
      const failedState = recordAttemptFailure(selectedState, nowMs);
      deps.registry.upsert(failedState);
      lastError = new Error(`No transport for endpoint: ${selectedState.id}`);
      continue;
    }

    // Increment inFlightCount immediately before sending
    const currentEndpointState = deps.registry.getById(selectedState.id) ?? selectedState;
    const incrementedState = {
      ...currentEndpointState,
      inFlightCount: (currentEndpointState.inFlightCount ?? 0) + 1,
    };
    deps.registry.upsert(incrementedState);

    // Determine timeout for this request
    const timeoutMs = selectedState.config.timeoutMs ?? config.defaultTimeoutMs;

    // Create request context
    const context = createRpcRequestContext(method, params, startedAtMs, timeoutMs);

    let attemptResult;
    try {
      // Execute the RPC attempt
      attemptResult = await executeRpcAttempt(transport, context, deps.clock, deps.timer);
    } finally {
      // Decrement inFlightCount
      const freshState = deps.registry.getById(selectedState.id);
      if (freshState) {
        const decrementedState = {
          ...freshState,
          inFlightCount: Math.max(0, (freshState.inFlightCount ?? 0) - 1),
        };
        deps.registry.upsert(decrementedState);
      }
    }

    // Track latency
    totalLatencyMs += attemptResult.latencyMs;

    // Handle success
    if (attemptResult.kind === "success") {
      const freshState = deps.registry.getById(selectedState.id) ?? selectedState;
      const successState = recordEndpointSuccess(freshState, attemptResult.latencyMs, nowMs);
      deps.registry.upsert(successState);

      return ok({
        value: attemptResult.value as TResult,
        endpointId: attemptResult.endpointId,
        attempts,
        latencyMs: totalLatencyMs,
      });
    }

    // Handle attempt failure
    // First, classify the error to determine if it's an endpoint fault
    const errorClass = classifyError(attemptResult.error);

    lastError = attemptResult.error;

    // If not an endpoint fault (e.g., RPC error), return immediately without retry
    if (!isEndpointFault(errorClass)) {
      // Record as request failure without updating endpoint health/circuit
      return err(attemptResult.error);
    }

    // For endpoint faults, record for circuit breaker and health tracking
    const freshState = deps.registry.getById(selectedState.id) ?? selectedState;
    let failureState = recordAttemptFailure(freshState, nowMs);

    // Check if circuit should open
    if (shouldOpenCircuit(failureState, config.circuitBreaker)) {
      const openedState = openCircuit(failureState, nowMs, config.circuitBreaker.openDurationMs);
      deps.registry.upsert(openedState);
    } else {
      deps.registry.upsert(failureState);
    }

    // Check if should retry
    if (!shouldRetry(attemptResult, attempts, config.retry)) {
      // If error is non-retryable, record as request failure and return immediately
      if (!isRetryableSdkError(attemptResult.error)) {
        failureState = recordRequestFailure(failureState, nowMs);
        deps.registry.upsert(failureState);
        return err(attemptResult.error);
      }
      // If retryable but maxAttempts reached, mark that we hit max retries
      failureState = recordRequestFailure(failureState, nowMs);
      deps.registry.upsert(failureState);
      hitMaxRetries = true;
      break;
    }

    // Compute backoff and wait if needed
    const backoffMs = computeBackoffMs(attempts, config.retry, deps.random);
    if (backoffMs > 0) {
      await new Promise<void>((resolve) => {
        deps.timer.setTimeout(resolve, backoffMs);
      });
    }
  }

  // All attempts exhausted
  if (hitMaxRetries) {
    // If we have multiple endpoints, return AllEndpointsFailed
    // Otherwise, return the specific error for the single endpoint
    if (initialEndpointCount > 1) {
      return err(
        createSdkError("AllEndpointsFailed", "All RPC endpoints failed", {
          cause: lastError,
        }),
      );
    }
    // Single endpoint - return its specific error
    if (lastError) {
      return err(lastError);
    }
  }

  // No error occurred (shouldn't reach here)
  return err(
    createSdkError("Unknown", "RPC request failed with no error details"),
  );
}
