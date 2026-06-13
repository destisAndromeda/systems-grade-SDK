/**
 * Relay routing logic.
 *
 * Routes transactions through relay first, falling back to RPC if configured.
 */

import type { RelayClient, RelayRoutingConfig, RoutedTransactionResult } from "./types.js";
import type { PreparedTransaction } from "../tx/types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { SendTransactionOptions } from "../tx/types.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";
import { ok, err, isOk, isErr } from "../core/result.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import { sendTransactionViaRpc } from "../tx/send.js";

/**
 * Route a transaction through relay with optional RPC fallback.
 *
 * Flow:
 *  1. If preferRelay and relay exists: try relay first
 *  2. On relay failure, optionally fall back to RPC
 *  3. If relay not preferred: use RPC directly
 *  4. Return result with route indicator
 *
 * @param prepared Prepared transaction
 * @param relay Relay client (or undefined to skip)
 * @param rpcTransport RPC transport for fallback or direct send
 * @param config Routing configuration
 * @param options Send transaction options (forwarded to RPC)
 * @returns Signature and route information, or error
 */
export async function routeTransaction(
  prepared: PreparedTransaction,
  relay: RelayClient | undefined,
  rpcTransport: RpcTransport,
  config: RelayRoutingConfig,
  options?: SendTransactionOptions,
): Promise<Result<RoutedTransactionResult, SdkError>> {
  // Case A: relay preferred and relay exists
  if (config.preferRelay && relay !== undefined) {
    try {
      const relayResult = await relay.sendTransaction(prepared.base64);
      // Relay succeeded
      return ok({
        signature: relayResult.signature,
        route: "relay",
        relayName: relayResult.relayName,
      });
    } catch (relayError: unknown) {
      // Relay failed
      if (!config.fallbackToRpc) {
        // No fallback configured: return relay error
        if (isKindOfSdkError(relayError)) {
          return err(relayError);
        }
        // Unknown error from relay
        return err(
          createSdkError("Unknown", `Relay error: ${String(relayError)}`, {
            cause: relayError,
          }),
        );
      }

      // Fall back to RPC
      const rpcResult = await sendTransactionViaRpc(rpcTransport, prepared, options);
      if (isOk(rpcResult)) {
        return ok({
          signature: rpcResult.value.signature,
          route: "rpc",
          endpointId: rpcResult.value.endpointId,
        });
      } else {
        return rpcResult as Result<RoutedTransactionResult, SdkError>;
      }
    }
  }

  // Case B: relay not preferred
  if (!config.preferRelay) {
    const rpcResult = await sendTransactionViaRpc(rpcTransport, prepared, options);
    if (isOk(rpcResult)) {
      return ok({
        signature: rpcResult.value.signature,
        route: "rpc",
        endpointId: rpcResult.value.endpointId,
      });
    } else {
      return rpcResult as Result<RoutedTransactionResult, SdkError>;
    }
  }

  // Case C: relay missing
  if (relay === undefined) {
    if (config.fallbackToRpc) {
      const rpcResult = await sendTransactionViaRpc(rpcTransport, prepared, options);
      if (isOk(rpcResult)) {
        return ok({
          signature: rpcResult.value.signature,
          route: "rpc",
          endpointId: rpcResult.value.endpointId,
        });
      } else {
        return rpcResult as Result<RoutedTransactionResult, SdkError>;
      }
    } else {
      return err(
        createSdkError("InvalidConfig", "Relay not provided and fallback to RPC disabled"),
      );
    }
  }

  // Should not reach here (logic above is exhaustive)
  return err(createSdkError("Unknown", "Unreachable code in routeTransaction"));
}

