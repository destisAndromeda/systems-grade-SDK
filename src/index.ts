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
export type { Result } from "./core/result.js";
export { ok, err, isOk, isErr, mapResult, unwrapResult } from "./core/result.js";
export type { Clock } from "./core/clock.js";
export { createSystemClock } from "./core/clock.js";
export type { Timer } from "./core/timer.js";
export { createSystemTimer } from "./core/timer.js";
export type { RandomSource } from "./core/random.js";
export { createMathRandomSource } from "./core/random.js";
export type { SdkError, SdkErrorKind } from "./core/error.js";
export { createSdkError, isKindOfSdkError, isRetryableSdkError, mapToSdkError } from "./core/error.js";

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
} from "./rpc/types.js";
export {
  normalizeRpcEndpointConfig,
  createEndpointId,
  createInitialEndpointState,
  recordEndpointSuccess,
  recordEndpointFailure,
  applyEndpointAttemptOutcome,
  isEndpointHealthy,
} from "./rpc/endpoint.js";
export { createEndpointRegistry } from "./rpc/registry.js";
export { scoreEndpoint, isEndpointCircuitOpen, selectBestEndpoint } from "./rpc/scoring.js";
export { shouldRetry, computeBackoffMs } from "./rpc/retry.js";
export { isWithinTimeout, createTimeoutError, withTimeout } from "./rpc/timeout.js";
export {
  shouldOpenCircuit,
  openCircuit,
  isCircuitOpen,
  maybeCloseCircuit,
} from "./rpc/circuit-breaker.js";
export {
  createRpcRequestContext,
  executeRpcAttempt,
  mapTransportErrorToSdkError,
} from "./rpc/transport.js";
export { createResilientRpcClient, executeResilientRpcRequest } from "./rpc/resilient-client.js";

// Transaction
export type {
  PreparedTransaction,
  SendTransactionOptions,
  SendTransactionResult,
  TransactionStatus,
  ConfirmationConfig,
  ConfirmationResult,
} from "./tx/types.js";
export {
  buildPreparedTransaction,
  isBlockhashExpired,
  simulateTransaction,
  sendTransactionViaRpc,
  sendTransactionWithResilience,
} from "./tx/send.js";
export {
  fetchTransactionStatus,
  isTerminalStatus,
  pollTransactionConfirmation,
} from "./tx/confirm.js";

// Relay
export type { RelayClient, RelayRoutingConfig, RelayRoutingResult } from "./relay/types.js";
export { routeTransaction } from "./relay/router.js";
export { createJitoRelayClient } from "./relay/jito.js";

// Fee
export type { PriorityFeeEstimate, PriorityFeeProvider, PriorityFeeConfig } from "./fee/types.js";
export {
  createStaticPriorityFeeProvider,
  createRpcPriorityFeeProvider,
  isPriorityFeeStale,
  getPriorityFeeEstimate,
} from "./fee/priority-fee.js";

// Metrics
export type { MetricEvent, MetricsSink } from "./metrics/types.js";
export { createInMemoryMetricsSink } from "./metrics/memory.js";
export { createOtelMetricsSink, mapMetricEventToOtelPayload } from "./metrics/otel.js";

// Wallet
export type { WalletAdapter, WalletSendOptions } from "./wallet/types.js";
export { signTransactionWithWallet, sendViaWallet } from "./wallet/adapter.js";

// SDK
export type { SolanaReliabilitySdkConfig, SolanaReliabilitySdk } from "./sdk/types.js";
export { validateSdkConfig, createSolanaReliabilitySdk } from "./sdk/create-sdk.js";

// Testing
export { createFakeClock } from "./testing/fake-clock.js";
export { createFakeTimer } from "./testing/fake-timer.js";
export { createFakeRandom } from "./testing/fake-random.js";
export { createFakeRpcTransport, FakeRpcTransportBuilder } from "./testing/fake-transport.js";
export { createFakeRelayClient } from "./testing/fake-relay.js";
export { simulateNetworkBehavior } from "./testing/network-simulator.js";

// CLI
export { runHealthCheck } from "./cli/health.js";
export { runSimulation } from "./cli/simulate.js";
