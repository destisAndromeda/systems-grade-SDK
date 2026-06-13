/**
 * Jito relay client adapter.
 *
 * Creates a RelayClient that sends transactions to Jito via RPC transport.
 */

import type { RelayClient, RelaySendResult } from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import { mapTransportErrorToSdkError } from "../rpc/transport.js";

/**
 * Create a Jito relay client.
 *
 * @param transport RPC transport to use for Jito endpoint
 * @param options Configuration options
 * @returns Jito relay client
 */
export function createJitoRelayClient(
  transport: RpcTransport,
  options?: {
    name?: string;
    method?: "sendTransaction" | "sendBundle";
  },
): RelayClient {
  const name = options?.name ?? "jito";
  const method = options?.method ?? "sendTransaction";

  const client: RelayClient = {
    name,

    async sendTransaction(base64: string): Promise<RelaySendResult> {
      try {
        let response: unknown;

        if (method === "sendBundle") {
          response = await transport.send<[string[]], string | { result?: string; signature?: string }>(
            "sendBundle",
            [[base64]],
          );
        } else {
          // sendTransaction
          response = await transport.send<
            [string, { encoding: string; skipPreflight: boolean }],
            string | { result?: string; signature?: string }
          >("sendTransaction", [base64, { encoding: "base64", skipPreflight: true }]);
        }

        // Parse signature from various response shapes
        let signature: string | undefined;

        if (typeof response === "string") {
          signature = response;
        } else if (response && typeof response === "object") {
          const obj = response as Record<string, unknown>;
          if ("result" in obj && typeof obj.result === "string") {
            signature = obj.result;
          } else if ("signature" in obj && typeof obj.signature === "string") {
            signature = obj.signature;
          }
        }

        // Validate signature
        if (!signature || signature.trim().length === 0) {
          throw createSdkError("InvalidResponse", "Jito relay response missing or empty signature");
        }

        return {
          signature,
          relayName: name,
        };
      } catch (error: unknown) {
        if (isKindOfSdkError(error)) {
          throw error;
        }
        throw mapTransportErrorToSdkError(error);
      }
    },
  };

  return client;
}

