/**
 * RPC transport utilities.
 *
 * Functions to create request context, execute attempts via a transport,
 * and map transport errors to SDK errors.
 */

import type { RpcTransport, RpcRequestContext, RpcAttemptResult } from "./types.js";
import type { Clock } from "../core/clock.js";
import type { SdkError } from "../core/error.js";
import { createSdkError } from "../core/error.js";

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
  // TODO: return context object with all parameters
  throw new Error("TODO");
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
): Promise<RpcAttemptResult<TResult>> {
  // TODO: measure latency, call transport.send, catch errors and map to SdkError,
  // return success or failure result with latencyMs and endpointId
  throw new Error("TODO");
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
  // TODO: classify error by type/message and return appropriate SdkError
  throw new Error("TODO");
}
