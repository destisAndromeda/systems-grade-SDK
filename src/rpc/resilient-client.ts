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

import type { RpcTransport, ResilientRpcConfig, ResilientRpcResult } from "./types";
import type { EndpointRegistry } from "./types";
import type { Clock } from "../core/clock";
import type { Timer } from "../core/timer";
import type { RandomSource } from "../core/random";
import type { Result } from "../core/result";
import { ok, err } from "../core/result";

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
  // TODO: return a single RpcTransport that implements the resilience flow
  throw new Error("TODO");
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
  // TODO: implement the resilience flow:
  // 1. select endpoint
  // 2. execute attempt
  // 3. record outcome to registry
  // 4. check if should retry or select new endpoint
  // 5. repeat until success or all attempts/endpoints exhausted
  throw new Error("TODO");
}
