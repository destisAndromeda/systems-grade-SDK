/**
 * RPC transport utilities.
 *
 * Functions to create request context, execute attempts via a transport,
 * and map transport errors to SDK errors.
 */

import type { RpcTransport, RpcRequestContext, RpcAttemptResult } from "./types.js";
import type { Clock } from "../core/clock.js";
import type { Timer } from "../core/timer.js";
import type { SdkError } from "../core/error.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import { withTimeout } from "./timeout.js";

/**
 * Create a request context for an RPC call.
 * Used to track timing and parameters for retry/timeout logic.
 */
export function createRpcRequestContext<TParams>(
  method: string,
  params: TParams,
  startedAtMs: number,
  timeoutMs?: number,
): RpcRequestContext<TParams> {
  const context: RpcRequestContext<TParams> = {
    method,
    params,
    startedAtMs,
  };

  if (timeoutMs !== undefined) {
    context.timeoutMs = timeoutMs;
  }

  return context;
}

/**
 * Execute a single RPC attempt via a transport.
 *
 * Measures latency, wraps errors in SdkError, returns success or failure result.
 *
 * @param transport RPC transport to use
 * @param context Request context with method/params
 * @param clock Clock for measuring time
 * @returns Attempt result (success or failure)
 */
export async function executeRpcAttempt<TParams, TResult>(
  transport: RpcTransport,
  context: RpcRequestContext<TParams>,
  clock: Clock,
  timer?: Timer,
): Promise<RpcAttemptResult<TResult>> {
  const startedAtMs = context.startedAtMs;

  try {
    // Create the send promise
    let promise = transport.send<TParams, TResult>(context.method, context.params, {
      timeoutMs: context.timeoutMs,
    });

    // Wrap with timeout if context has timeout and we have a timer
    if (context.timeoutMs !== undefined && timer !== undefined) {
      promise = withTimeout(promise, context.timeoutMs, timer, clock, context.method);
    }

    const value = await promise;
    const latencyMs = Math.max(0, clock.now() - startedAtMs);

    return {
      kind: "success",
      value,
      latencyMs,
      endpointId: transport.endpointId,
    };
  } catch (error: unknown) {
    const latencyMs = Math.max(0, clock.now() - startedAtMs);
    const mappedError = mapTransportErrorToSdkError(error);

    return {
      kind: "failure",
      error: mappedError,
      latencyMs,
      endpointId: transport.endpointId,
    };
  }
}

/**
 * Map a transport error to an SdkError.
 *
 * Classifies errors based on type/message:
 *  - Timeout → "Timeout"
 *  - HTTP 429 → "RateLimited"
 *  - Network error → "NetworkError"
 *  - Unknown → "Unknown"
 *
 * @param error Error from transport
 * @returns Classified SdkError
 */
export function mapTransportErrorToSdkError(error: unknown): SdkError {
  // If already an SdkError, return unchanged
  if (isKindOfSdkError(error)) {
    return error;
  }

  // Convert to string for message-based detection
  const message = String(error instanceof Error ? error.message : error);

  // Detect timeout errors
  if (
    (typeof error === "object" && error !== null && "kind" in error && (error as Record<string, unknown>).kind === "Timeout") ||
    (typeof error === "object" && error !== null && "name" in error && (error as Record<string, unknown>).name === "AbortError") ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("timed out") ||
    message.includes("ETIMEDOUT")
  ) {
    return createSdkError("Timeout", message, { cause: error instanceof Error ? error : undefined });
  }

  // Detect rate limit errors
  if (
    (typeof error === "object" && error !== null && "status" in error && (error as Record<string, unknown>).status === 429) ||
    (typeof error === "object" && error !== null && "statusCode" in error && (error as Record<string, unknown>).statusCode === 429) ||
    (typeof error === "object" && error !== null && "code" in error && (error as Record<string, unknown>).code === 429) ||
    message.toLowerCase().includes("rate limit") ||
    message.includes("429")
  ) {
    return createSdkError("RateLimited", message, { cause: error instanceof Error ? error : undefined });
  }

  // Detect network errors
  if (
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.toLowerCase().includes("socket") ||
    message.toLowerCase().includes("connection")
  ) {
    return createSdkError("NetworkError", message, { cause: error instanceof Error ? error : undefined });
  }

  // Fallback to unknown error
  return createSdkError("Unknown", message, { cause: error instanceof Error ? error : undefined });
}
