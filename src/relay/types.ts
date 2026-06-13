/**
 * MEV relay types.
 *
 * Data structures for routing transactions through MEV relays (Jito, etc.)
 * with fallback to standard RPC if relay is unavailable.
 */

import type { SendTransactionResult } from "../tx/types";
import type { PreparedTransaction } from "../tx/types";
import type { Result } from "../core/result";

/**
 * MEV relay client interface.
 * Sends transactions through a relay to avoid frontrunning.
 */
export interface RelayClient {
  readonly name: string;

  /**
   * Send a transaction via this relay.
   *
   * @param prepared Prepared transaction
   * @param tip Optional tip to include with the transaction (in lamports)
   * @returns Signature and relay endpoint ID, or error
   */
  sendTransaction(
    prepared: PreparedTransaction,
    options?: { tip?: number },
  ): Promise<Result<SendTransactionResult>>;
}

/**
 * Configuration for relay routing.
 */
export interface RelayRoutingConfig {
  relayTimeoutMs: number; // Timeout for relay attempts
  fallbackToRpc: boolean; // If true, fall back to RPC if relay fails
  tipLamports?: number; // Optional tip to include
}

/**
 * Result of routing a transaction (relay or RPC).
 */
export interface RelayRoutingResult extends SendTransactionResult {
  route: "relay" | "rpc";
  relayName?: string; // Name of relay used (if route="relay")
}
