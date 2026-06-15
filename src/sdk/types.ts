/**
 * SDK types and configuration.
 *
 * Top-level SDK configuration and interface.
 */

import type { ResilientRpcConfig, RpcTransport } from "../rpc/types.js";
import type { RelayClient } from "../relay/types.js";
import type { PriorityFeeConfig, PriorityFeeEstimate } from "../fee/types.js";
import type { MetricsSink, MetricEvent } from "../metrics/types.js";
import type { TransactionWallet } from "../wallet/types.js";
import type { SendTransactionOptions, ConfirmationConfig } from "../tx/types.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";

/**
 * Complete SDK configuration.
 */
export interface SolanaReliabilitySdkConfig {
  // RPC endpoints
  endpoints: string[];

  // Genesis guard configuration
  enableGenesisGuard?: boolean;
  genesisGuardStrict?: boolean;

  // Retry policy
  retry?: Partial<{
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterRatio: number;
  }>;

  // Circuit breaker policy
  circuitBreaker?: Partial<{
    failureThreshold: number;
    cooldownMs: number;
    halfOpenAttemptsPerWindow: number;
  }>;

  // Default timeout
  defaultTimeoutMs?: number;

  // Transaction confirmation
  confirmation?: Partial<ConfirmationConfig>;

  // Priority fee
  priorityFee?: Partial<PriorityFeeConfig>;

  // Relay routing
  relay?: RelayClient;
  relayRouting?: Partial<{
    preferRelay: boolean;
    fallbackToRpc: boolean;
  }>;

  // Wallet adapter
  wallet?: TransactionWallet;

  // Metrics sink
  metrics?: MetricsSink;
}

/**
 * Solana Reliability SDK facade.
 *
 * Provides high-level methods for sending, confirming, and managing transactions
 * with automatic resilience, retry logic, circuit breaking, and metrics.
 */
export interface SolanaReliabilitySdk {
  /**
   * Resilient RPC transport for direct method calls.
   */
  rpc: RpcTransport;

  /**
   * Send a prepared transaction with resilience.
   *
   * Routes through relay if configured, falls back to RPC, and records metrics.
   *
   * @param base64 Base64-encoded transaction
   * @param blockhash Recent blockhash
   * @param lastValidBlockHeight Block height for blockhash expiry
   * @param options Optional send options (skipPreflight, maxRetries, etc.)
   * @returns Transaction signature or error
   */
  sendTransaction(
    base64: string,
    blockhash: string,
    lastValidBlockHeight: number,
    options?: SendTransactionOptions,
  ): Promise<Result<string, SdkError>>;

  /**
   * Confirm a transaction with polling.
   *
   * Polls for confirmation status until timeout or terminal state.
   *
   * @param signature Transaction signature
   * @param config Optional confirmation config overrides
   * @returns Confirmation status or error
   */
  confirmTransaction(
    signature: string,
    config?: Partial<ConfirmationConfig>,
  ): Promise<Result<{ confirmed: boolean; slot?: number }, SdkError>>;

  /**
   * Get current priority fee estimate.
   *
   * Tries RPC provider, falls back to static fee, returns error if both fail.
   *
   * @returns Priority fee in microlamports or error
   */
  getPriorityFee(): Promise<Result<number, SdkError>>;

  /**
   * Get health information for all RPC endpoints.
   *
   * Returns synchronously without network calls.
   *
   * @returns Array of endpoint health information
   */
  getEndpointHealth(): Array<{
    id: string;
    url: string;
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    avgLatencyMs: number;
    circuitOpen: boolean;
  }>;

  /**
   * Get recorded metrics.
   *
   * @returns Array of metric events (empty array if not available)
   */
  getMetrics(): MetricEvent[];

  /**
   * Genesis guard results (if enabled)
   */
  quarantinedEndpoints?: string[] | undefined;
  genesisHash?: string | undefined;
  genesisGuardWarning?: string | undefined;
  genesisGuardPromise?: Promise<any> | undefined;
}
