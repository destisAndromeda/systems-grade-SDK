/**
 * Solana Reliability SDK
 *
 * A lightweight, systems-grade SDK that improves RPC reliability for Solana dApps.
 *
 * Features:
 * - Resilient RPC calls with retry and circuit breaker
 * - Multi-endpoint failover and intelligent selection
 * - Transaction sending with optional relay support
 * - Transaction confirmation polling
 * - Priority fee estimation
 * - Observability and metrics
 * - Deterministic testing with fake clocks/timers
 *
 * Usage:
 *   import { createSolanaReliabilitySdk } from "@solana-kit/sdk";
 *
 *   const sdk = await createSolanaReliabilitySdk({
 *     rpcEndpoints: ["https://api.mainnet-beta.solana.com", "https://backup.rpc.solana.com"],
 *   });
 *
 *   const signature = await sdk.sendTransaction(txBase64, blockhash, lastValidBlockHeight);
 *   const confirmed = await sdk.confirmTransaction(signature);
 */

// Core
export { Result, ok, err, isOk, isErr, mapResult, unwrapResult } from "./core/result";
export { Clock, createSystemClock } from "./core/clock";
export { Timer, createSystemTimer } from "./core/timer";
export { RandomSource, createMathRandomSource } from "./core/random";
export type { SdkError, SdkErrorKind } from "./core/error";
export { createSdkError, isRetryableSdkError, mapToSdkError } from "./core/error";

// RPC
export type {
  RpcEndpointConfig,
  RpcEndpointState,
  EndpointRegistry,
  RpcTransport,
  RpcRequestContext,
  RpcAttemptResult,
  RetryConfig,
  CircuitBreakerConfig,
  EndpointScoreConfig,
  ResilientRpcConfig,
  ResilientRpcResult,
} from "./rpc/types";
export {
  normalizeRpcEndpointConfig,
  createEndpointId,
  createInitialEndpointState,
  recordEndpointSuccess,
  recordEndpointFailure,
  applyEndpointAttemptOutcome,
  isEndpointHealthy,
} from "./rpc/endpoint";
export { createEndpointRegistry } from "./rpc/registry";
export { scoreEndpoint, isEndpointCircuitOpen, selectBestEndpoint } from "./rpc/scoring";
export { shouldRetry, computeBackoffMs } from "./rpc/retry";
export { isWithinTimeout, createTimeoutError, withTimeout } from "./rpc/timeout";
export {
  shouldOpenCircuit,
  openCircuit,
  isCircuitOpen,
  maybeCloseCircuit,
} from "./rpc/circuit-breaker";
export {
  createRpcRequestContext,
  executeRpcAttempt,
  mapTransportErrorToSdkError,
} from "./rpc/transport";
export { createResilientRpcClient, executeResilientRpcRequest } from "./rpc/resilient-client";

// Transaction
export type {
  PreparedTransaction,
  SendTransactionOptions,
  SendTransactionResult,
  TransactionStatus,
  ConfirmationConfig,
  ConfirmationResult,
} from "./tx/types";
export {
  buildPreparedTransaction,
  isBlockhashExpired,
  simulateTransaction,
  sendTransactionViaRpc,
  sendTransactionWithResilience,
} from "./tx/send";
export {
  fetchTransactionStatus,
  isTerminalStatus,
  pollTransactionConfirmation,
} from "./tx/confirm";

// Relay
export type { RelayClient, RelayRoutingConfig, RelayRoutingResult } from "./relay/types";
export { routeTransaction } from "./relay/router";
export { createJitoRelayClient } from "./relay/jito";

// Fee
export type { PriorityFeeEstimate, PriorityFeeProvider, PriorityFeeConfig } from "./fee/types";
export {
  createStaticPriorityFeeProvider,
  createRpcPriorityFeeProvider,
  isPriorityFeeStale,
  getPriorityFeeEstimate,
} from "./fee/priority-fee";

// Metrics
export type { MetricEvent, MetricsSink } from "./metrics/types";
export { createInMemoryMetricsSink } from "./metrics/memory";
export { createOtelMetricsSink, mapMetricEventToOtelPayload } from "./metrics/otel";

// Wallet
export type { WalletAdapter, WalletSendOptions } from "./wallet/types";
export { signTransactionWithWallet, sendViaWallet } from "./wallet/adapter";

// SDK
export type { SolanaReliabilitySdkConfig, SolanaReliabilitySdk } from "./sdk/types";
export { validateSdkConfig, createSolanaReliabilitySdk } from "./sdk/create-sdk";

// Testing
export { createFakeClock } from "./testing/fake-clock";
export { createFakeTimer } from "./testing/fake-timer";
export { createFakeRandom } from "./testing/fake-random";
export { createFakeRpcTransport, FakeRpcTransportBuilder } from "./testing/fake-transport";
export { createFakeRelayClient } from "./testing/fake-relay";
export { simulateNetworkBehavior } from "./testing/network-simulator";

// CLI
export { runHealthCheck } from "./cli/health";
export { runSimulation } from "./cli/simulate";
