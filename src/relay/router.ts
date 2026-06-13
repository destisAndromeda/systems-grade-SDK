/**
 * Relay routing logic.
 *
 * Routes transactions through relay(s) first, falling back to RPC if configured.
 */

import type { RelayClient, RelayRoutingConfig, RelayRoutingResult } from "./types";
import type { PreparedTransaction } from "../tx/types";
import type { RpcTransport } from "../rpc/types";
import type { Timer } from "../core/timer";
import type { Clock } from "../core/clock";
import type { Result } from "../core/result";
import { ok, err } from "../core/result";

/**
 * Route a transaction through relay with optional RPC fallback.
 *
 * Flow:
 *  1. Try to send via relay(s)
 *  2. If relay fails and fallbackToRpc is true, fall back to resilient RPC
 *  3. Return result with route indicator
 *
 * @param prepared Prepared transaction
 * @param relay Relay client (or null to skip relay)
 * @param rpcTransport Resilient RPC transport for fallback
 * @param config Relay routing configuration
 * @param deps Timer and Clock for timeout handling
 * @returns Signature and route information, or error
 */
export async function routeTransaction(
  prepared: PreparedTransaction,
  relay: RelayClient | null,
  rpcTransport: RpcTransport,
  config: RelayRoutingConfig,
  deps: { timer: Timer; clock: Clock },
): Promise<Result<RelayRoutingResult>> {
  // TODO: try relay first (if provided), then fallback to RPC if configured,
  // return ok with route indicator or err if all fail
  throw new Error("TODO");
}
