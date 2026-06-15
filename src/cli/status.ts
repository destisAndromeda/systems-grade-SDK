/**
 * Transaction status command.
 *
 * Fetches and formats transaction status using getSignatureStatuses.
 */

import type { RpcTransport } from "../rpc/types.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";
import type { TransactionConfirmationStatus } from "../tx/types.js";
import { createHttpRpcTransport } from "../rpc/http-transport.js";
import { createEndpointId, normalizeRpcEndpointConfig } from "../rpc/endpoint.js";
import { isOk } from "../core/result.js";
import { fetchTransactionStatus } from "../tx/confirm.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for the status command.
 */
export interface StatusCommandOptions {
  /** RPC endpoint URL to query. Required unless deps.transport is provided. */
  endpointUrl: string;
  /** Optional request timeout in ms. */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a transaction status result into a human-readable string.
 *
 * @param signature Transaction signature
 * @param result Result from fetchTransactionStatus
 * @returns Formatted status string
 */
export function formatTransactionStatus(
  signature: string,
  result: Result<TransactionConfirmationStatus, SdkError>,
): string {
  if (!result.ok) {
    return `Error fetching transaction status for ${signature}: ${result.error.message}`;
  }

  const status = result.value;

  switch (status.kind) {
    case "pending":
      return `Transaction ${signature}: pending`;

    case "confirmed":
      return status.slot !== undefined
        ? `Transaction ${signature}: confirmed at slot ${status.slot}`
        : `Transaction ${signature}: confirmed`;

    case "finalized":
      return status.slot !== undefined
        ? `Transaction ${signature}: finalized at slot ${status.slot}`
        : `Transaction ${signature}: finalized`;

    case "failed":
      return `Transaction ${signature}: failed: ${status.error}`;

    default: {
      // exhaustive check helper
      const _exhaustive: never = status;
      return `Transaction ${signature}: unknown status`;
    }
  }
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

/**
 * Fetch and format transaction status for a given signature.
 *
 * Uses a real HTTP transport by default; inject deps.transport in tests.
 *
 * @param signature Transaction signature to look up
 * @param endpointOrOptions Endpoint URL string or Command options
 * @param deps Injectable dependencies for testing
 * @returns Formatted status string (never throws)
 */
export async function createTransactionStatusReport(
  signature: string,
  endpointOrOptions: string | StatusCommandOptions,
  deps?: {
    transport?: RpcTransport;
  },
): Promise<string> {
  // Validate signature
  if (!signature || signature.trim().length === 0) {
    return `Usage: solana-reliability-sdk status <signature> --endpoint <rpc-url>\n\nMissing: <signature>`;
  }

  const endpointUrl = typeof endpointOrOptions === "string" ? endpointOrOptions : endpointOrOptions?.endpointUrl;

  // Determine transport
  let transport: RpcTransport;

  if (deps?.transport) {
    transport = deps.transport;
  } else {
    // Validate endpoint URL
    if (!endpointUrl || endpointUrl.trim().length === 0) {
      return `Usage: solana-reliability-sdk status <signature> --endpoint <rpc-url>\n\nMissing: --endpoint <rpc-url>`;
    }

    const normalizeResult = normalizeRpcEndpointConfig(endpointUrl);
    if (!isOk(normalizeResult)) {
      return `Error: Invalid endpoint URL: ${normalizeResult.error.message}`;
    }

    const endpointConfig = normalizeResult.value;
    transport = createHttpRpcTransport({
      endpointUrl: endpointConfig.url,
      endpointId: createEndpointId(endpointConfig),
    });
  }

  const result = await fetchTransactionStatus(transport, signature);
  return formatTransactionStatus(signature, result);
}
