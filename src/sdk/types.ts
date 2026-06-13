/**
 * SDK types and configuration.
 *
 * Top-level SDK configuration and interface.
 */

import type { ResilientRpcConfig } from "../rpc/types.js";
import type { RelayClient } from "../relay/types.js";
import type { PriorityFeeConfig } from "../fee/types.js";
import type { MetricsSink } from "../metrics/types.js";
import type { TransactionWallet } from "../wallet/types.js";

/**
 * Complete SDK configuration.
 */
export interface SolanaReliabilitySdkConfig {
  // RPC configuration
  rpcEndpoints: string[]; // Array of RPC endpoint URLs
  rpcConfig?: Partial<ResilientRpcConfig>; // Optional overrides for retry/circuit/scoring

  // Transaction configuration
  confirmationTimeoutMs?: number; // Timeout for transaction confirmation (default: 60000)
  confirmationIntervalMs?: number; // Polling interval for confirmation (default: 1000)

  // Priority fee configuration
  priorityFeeConfig?: PriorityFeeConfig; // Fee estimation config
  priorityFeeMicroLamports?: number; // Static priority fee (overrides providers)

  // Relay configuration
  relayClient?: RelayClient | null; // Optional MEV relay (e.g. Jito)
  relayFallbackToRpc?: boolean; // Fall back to RPC if relay fails (default: true)

  // Metrics
  metricsSink?: MetricsSink; // Optional metrics sink for observability

  // Wallet (optional)
  wallet?: TransactionWallet; // Optional wallet for signing
}

/**
 * Solana Reliability SDK facade.
 *
 * Provides high-level methods for:
 *  - Sending transactions with resilience
 *  - Confirming transactions
 *  - Getting priority fee estimates
 *  - Accessing registry/health info
 */
export interface SolanaReliabilitySdk {
  /**
   * Send a prepared transaction.
   *
   * @param transactionBase64 Base64-encoded transaction
   * @param blockhash Recent blockhash
   * @param lastValidBlockHeight Block height for blockhash expiry
   * @returns Transaction signature
   */
  sendTransaction(
    transactionBase64: string,
    blockhash: string,
    lastValidBlockHeight: number,
  ): Promise<string>;

  /**
   * Confirm a transaction signature.
   *
   * @param signature Transaction signature to confirm
   * @returns Confirmation result
   */
  confirmTransaction(signature: string): Promise<{ confirmed: boolean; slot?: number }>;

  /**
   * Get current priority fee estimate.
   *
   * @returns Priority fee in microlamports
   */
  getPriorityFee(): Promise<number>;

  /**
   * Get registry of RPC endpoints and their health.
   */
  getEndpointHealth(): Promise<{
    endpoints: Array<{
      url: string;
      healthy: boolean;
      successRate: number;
      avgLatencyMs: number;
    }>;
  }>;
}
