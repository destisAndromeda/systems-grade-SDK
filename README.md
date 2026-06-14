# Solana Reliability SDK

A lightweight TypeScript SDK that improves Solana RPC and transaction reliability for dApps through endpoint scoring, retry/timeout/circuit-breaker policies, transaction sending, relay fallback, wallet signing, fee estimation, metrics, diagnostics, and deterministic network simulation tests.

## Why this exists

Solana dApps often depend on multiple RPC endpoints to reach the network. However:

- **RPC endpoints become flaky**: They can slow down, rate-limit, fail temporarily, or go offline without warning.
- **Transactions are fire-and-forget**: Once you send a transaction, tracking confirmation requires repeated status checks.
- **Relay routing improves outcomes**: MEV-aware transaction routes (via Jito, etc.) can succeed where standard RPC sends fail.
- **Observability is hard**: You need metrics on endpoint health, retry attempts, and transaction latency to debug production issues.
- **Testing failure modes is painful**: Deterministic tests require local fakes, not relying on network failures.

This SDK provides resilient RPC client behavior, transaction send/confirm helpers, relay fallback routing, wallet integration, and observability—all testable with deterministic fakes.

## Feature summary

- **Resilient RPC endpoint selection**: Automatic failover between multiple endpoints with latency tracking and scoring.
- **Retry, timeout, backoff, and circuit breaker policies**: Configurable strategies to handle transient failures gracefully.
- **Transaction send and confirmation helpers**: Submit transactions as base64, poll for confirmation, check status.
- **Jito/MEV relay routing with RPC fallback**: Try MEV-optimized relay first; fall back to standard RPC on failure.
- **Priority fee estimation**: Static or RPC-based priority fee providers with staleness detection.
- **Wallet Standard / Phantom-compatible signing adapter**: Integrate any Wallet Standard Solana wallet for transaction signing.
- **`@solana/kit` transaction compatibility**: Build transactions with Web3.js v2, serialize to base64, send via SDK.
- **Datadog HTTP metrics exporter**: Send metrics to Datadog `/api/v2/series` endpoint; tested with local HTTP server.
- **OpenTelemetry-shaped metrics payload mapper**: Convert SDK metric events to OTEL format.
- **Diagnostics CLI**:
  - `health [--watch] [--interval-ms <ms>] <endpoint>...` – Active RPC health checks with optional polling.
  - `status <signature> --endpoint <rpc-url>` – Fetch transaction confirmation status.
  - `simulate` – Deterministic offline reliability simulation.
- **Fake transports, relays, timers, clocks**: Deterministic testing without live RPC or network failures.
- **90%+ test coverage**: 597 tests across 41 test files with network simulation coverage.

## Bounty compliance

| Requirement | Status | Evidence |
|---|---|---|
| **Web3.js v2.0 / `@solana/kit` compatibility verified with tests** | ✅ | [`test/integration/solana-kit-compat.test.ts`](test/integration/solana-kit-compat.test.ts) builds a real `@solana/kit` transaction, serializes it to base64, and sends it through `sdk.sendTransaction(...)`. |
| **Wallet adapter integration with at least one major wallet** | ✅ | [`createWalletStandardTransactionWallet(...)`](src/wallet/standard-wallet.ts) adapts Phantom-compatible Wallet Standard wallets exposing `solana:signTransaction`; covered by [`test/wallet/standard-wallet.test.ts`](test/wallet/standard-wallet.test.ts). |
| **Jito/MEV routing implemented and documented** | ✅ | [`createJitoRelayClient`](src/relay/jito.ts), [`routeTransaction`](src/relay/router.ts), relay-first sending with RPC fallback. Tested in [`test/relay/router.test.ts`](test/relay/router.test.ts) and [`test/integration/relay-fallback.test.ts`](test/integration/relay-fallback.test.ts). |
| **Observability exports working with OpenTelemetry or Datadog** | ✅ | Datadog HTTP exporter sends real `fetch` POST requests to `/api/v2/series`; covered by [`test/metrics/datadog.test.ts`](test/metrics/datadog.test.ts) with a local HTTP server. OTEL payload mapping in [`test/metrics/otel.test.ts`](test/metrics/otel.test.ts). |
| **Diagnostics CLI functional** | ✅ | CLI supports active `health`, `health --watch`, `status <signature> --endpoint <url>`, and deterministic `simulate`; reference [`src/cli/`](src/cli) and tests in [`test/cli/`](test/cli/). |
| **Real-time monitoring for RPC health and transaction status** | ✅ | `health --watch` provides polling RPC health monitoring; `status` fetches transaction status by signature. Tested in [`test/cli/health.test.ts`](test/cli/health.test.ts) and [`test/cli/status.test.ts`](test/cli/status.test.ts). |
| **90%+ test coverage with network simulation tests** | ✅ | Latest local V8 coverage: **91.89% statements / 92.53% lines**. Network failure behavior tested with fake transports, relays, timers/clocks in [`test/integration/`](test/integration/). |

## Installation & development setup

```bash
npm install
npm run typecheck
npm test
npm run coverage
npm run build
```

Available example scripts:

```bash
npm run example:basic           # Basic SDK usage
npm run example:relay-fallback  # Relay routing with RPC fallback
npm run example:wallet-adapter  # Wallet Standard integration
npm run example:demo            # Judge demo (MVP showcase)
npm run example:devnet          # Devnet smoke test
```

CLI command:

```bash
npm run cli -- health https://api.mainnet-beta.solana.com
npm run cli -- status <signature> --endpoint https://api.mainnet-beta.solana.com
npm run cli -- simulate
```

## Quick start

```typescript
import { createSolanaReliabilitySdk, isOk } from "solana-sdk";

const sdkResult = createSolanaReliabilitySdk({
  endpoints: [
    "https://api.mainnet-beta.solana.com",
    "https://your-backup-rpc.example.com",
  ],
  retry: {
    maxAttempts: 3,
    baseDelayMs: 100,
  },
});

if (!isOk(sdkResult)) {
  throw sdkResult.error;
}

const sdk = sdkResult.value;

// Send a transaction
const result = await sdk.sendTransaction(
  transactionBase64,
  recentBlockhash,
  lastValidBlockHeight,
  {
    skipPreflight: true,
    maxRetries: 0,
  },
);

if (!isOk(result)) {
  throw result.error;
}

console.log("signature:", result.value);

// Confirm the transaction
const confirmResult = await sdk.confirmTransaction(result.value);
if (isOk(confirmResult)) {
  console.log("confirmed:", confirmResult.value.confirmed);
}

// Check endpoint health
const health = sdk.getEndpointHealth();
console.log(health);
```

## Core concepts

### Resilient RPC

The SDK maintains a registry of RPC endpoints with per-endpoint state tracking:

- **Endpoint normalization**: URLs are parsed and stored with consistent IDs.
- **State tracking**: Each endpoint records success/failure counts, consecutive failures, and average latency.
- **Scoring**: Endpoints are scored based on latency and failure rate; healthy endpoints are preferred.
- **Retry strategy**: Failed requests retry with exponential backoff up to `maxAttempts`.
- **Timeout policy**: Requests fail if they exceed `defaultTimeoutMs`.
- **Circuit breaker**: An endpoint is temporarily disabled after `failureThreshold` consecutive failures; it re-enables after `cooldownMs`.
- **Failover**: If the best endpoint fails, the SDK automatically tries the next healthiest endpoint.

**Key exports:**

- [`createEndpointRegistry`](src/rpc/registry.ts) – Initialize the endpoint registry.
- [`selectBestEndpoint`](src/rpc/scoring.ts) – Pick the healthiest endpoint.
- [`executeResilientRpcRequest`](src/rpc/resilient-client.ts) – Execute an RPC call with retry and failover.
- [`createHttpRpcTransport`](src/rpc/http-transport.ts) – HTTP transport implementation.

### Transaction sending

Transactions are submitted to Solana as base64-encoded wire transactions:

- **Wire format**: `sendTransaction` uses base64 encoding for the full serialized transaction.
- **Blockhash and expiry**: Each transaction includes a recent blockhash and `lastValidBlockHeight` to prevent replay and avoid expired submissions.
- **Confirmation polling**: The SDK polls `getSignatureStatuses` at regular intervals until the transaction reaches a terminal status.
- **Relay routing** (optional): If a relay is configured, the SDK tries to send via relay first; if that fails, it falls back to RPC.

**Key exports:**

- [`buildPreparedTransaction`](src/tx/send.ts) – Prepare a transaction for sending.
- [`sendTransactionViaRpc`](src/tx/send.ts) – Send via RPC directly.
- [`sendTransactionWithResilience`](src/tx/send.ts) – Send with retry, timeout, and failover.
- [`pollTransactionConfirmation`](src/tx/confirm.ts) – Poll for confirmation status.
- [`fetchTransactionStatus`](src/tx/confirm.ts) – Fetch current status by signature.

### `@solana/kit` / Web3.js v2 compatibility

The SDK does not require `@solana/web3.js` v1. Instead:

1. Build a transaction with `@solana/kit` (Web3.js v2).
2. Sign it (e.g., with wallet or keypair).
3. Serialize to base64 using `getBase64EncodedWireTransaction`.
4. Pass the base64 to `sdk.sendTransaction(...)`.

The SDK handles the rest: retry, failover, confirmation polling, and metrics.

**Example:**

```typescript
import {
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

const source = await generateKeyPairSigner();
const destination = await generateKeyPairSigner();

const transfer = getTransferSolInstruction({
  source,
  destination: destination.address,
  amount: lamports(1n),
});

const tx = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(source, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstruction(transfer, tx),
);

const signed = await signTransactionMessageWithSigners(tx);
const base64 = getBase64EncodedWireTransaction(signed);

const result = await sdk.sendTransaction(
  base64,
  latestBlockhash.blockhash,
  Number(latestBlockhash.lastValidBlockHeight),
);
```

**Test:** [`test/integration/solana-kit-compat.test.ts`](test/integration/solana-kit-compat.test.ts)

### Wallet Standard / Phantom-compatible adapter

The SDK has a minimal `TransactionWallet` interface for signing transactions:

```typescript
export interface TransactionWallet {
  publicKey?: string;
  signTransaction(base64: string): Promise<WalletSignResult>;
}
```

`createWalletStandardTransactionWallet(...)` adapts Wallet Standard Solana wallets:

- Detects the wallet's `solana:signTransaction` feature.
- Calls the wallet's sign method with the transaction bytes.
- Returns the signed transaction and public key.

The wallet signs; the SDK still sends through its resilient RPC pipeline, preserving retry/fallback/circuit-breaker behavior.

**Example:**

```typescript
import {
  createSolanaReliabilitySdk,
  createWalletStandardTransactionWallet,
  isOk,
} from "solana-sdk";

// Assume `phantomWallet` is a Wallet Standard wallet with solana:signTransaction
const wallet = createWalletStandardTransactionWallet(phantomWallet);

const sdkResult = createSolanaReliabilitySdk({
  endpoints: ["https://api.mainnet-beta.solana.com"],
  wallet,
});

if (!isOk(sdkResult)) {
  throw sdkResult.error;
}

const result = await sdkResult.value.sendTransaction(
  unsignedBase64,
  blockhash,
  lastValidBlockHeight,
);
```

**Test:** [`test/wallet/standard-wallet.test.ts`](test/wallet/standard-wallet.test.ts)

### Relay / Jito routing

If a relay client is configured and `preferRelay` is true, the SDK attempts to send via relay before RPC:

- **Relay-first**: Try sending via the relay (e.g., Jito).
- **RPC fallback**: If the relay fails with a retryable error, fall back to standard RPC.
- **Metrics**: Both relay and RPC routes record metrics for observability.

**Key exports:**

- [`createJitoRelayClient`](src/relay/jito.ts) – Create a Jito relay client.
- [`routeTransaction`](src/relay/router.ts) – Route a transaction (relay-first or RPC-only).

**Example:**

```typescript
import {
  createSolanaReliabilitySdk,
  createJitoRelayClient,
  isOk,
} from "solana-sdk";

const relayClient = createJitoRelayClient(rpcTransport, {
  name: "jito",
  bundleApiUrl: "https://bundles.jito.wtf", // Optional
});

const sdkResult = createSolanaReliabilitySdk({
  endpoints: ["https://api.mainnet-beta.solana.com"],
  relay: relayClient,
  relayRouting: {
    preferRelay: true,
    fallbackToRpc: true,
  },
});
```

**Tests:** [`test/relay/router.test.ts`](test/relay/router.test.ts), [`test/integration/relay-fallback.test.ts`](test/integration/relay-fallback.test.ts)

### Priority fee estimation

The SDK supports two fee providers:

- **Static**: A fixed microlamport amount (useful for dev/testing).
- **RPC-based**: Query `getRecentPrioritizationFees` from an RPC endpoint.

Both detect stale estimates and fall back to a configured default if needed.

**Key exports:**

- [`createStaticPriorityFeeProvider`](src/fee/priority-fee.ts) – Fixed fee.
- [`createRpcPriorityFeeProvider`](src/fee/priority-fee.ts) – RPC-based fee.
- [`getPriorityFeeEstimate`](src/fee/priority-fee.ts) – Get current estimate.
- [`isPriorityFeeStale`](src/fee/priority-fee.ts) – Check staleness.

### Observability

The SDK can record metric events and export them to various backends:

- **In-memory sink**: Store events in memory for dev/testing.
- **OTEL-shaped mapper**: Convert SDK events to OpenTelemetry format.
- **Datadog HTTP exporter**: Send metrics to Datadog via `/api/v2/series`.

Metrics include RPC attempt latency, failures, relay attempts, and transaction confirmations.

**Example:**

```typescript
import {
  createSolanaReliabilitySdk,
  createDatadogMetricsSink,
  isOk,
} from "solana-sdk";

const metrics = createDatadogMetricsSink({
  apiKey: process.env.DD_API_KEY!,
  service: "my-solana-dapp",
  env: "production",
  defaultTags: ["component:rpc"],
});

const sdkResult = createSolanaReliabilitySdk({
  endpoints: ["https://api.mainnet-beta.solana.com"],
  metrics,
});
```

**Test:** [`test/metrics/datadog.test.ts`](test/metrics/datadog.test.ts) uses a local HTTP server to verify the exporter sends correct payloads.

**Key exports:**

- [`createInMemoryMetricsSink`](src/metrics/memory.ts) – In-memory storage.
- [`createOtelMetricsSink`](src/metrics/otel.ts) – OTEL format mapper.
- [`createDatadogMetricsSink`](src/metrics/datadog.ts) – Datadog HTTP exporter.
- [`sendDatadogMetrics`](src/metrics/datadog.ts) – Manual send helper.
- [`mapMetricEventToOtelPayload`](src/metrics/otel.ts) – Convert to OTEL.
- [`mapMetricEventToDatadogPayload`](src/metrics/datadog.ts) – Convert to Datadog.

### Diagnostics CLI

The SDK includes a command-line tool for active health checks, transaction status lookups, and deterministic simulations:

```bash
npm run cli -- health https://api.mainnet-beta.solana.com https://backup.rpc.solana.com
```

**Output:**

```
Endpoint: https://api.mainnet-beta.solana.com
  ✓ Success: 5 | Failures: 0 | Avg Latency: 120ms | Circuit: CLOSED

Endpoint: https://backup.rpc.solana.com
  ✓ Success: 8 | Failures: 1 | Avg Latency: 110ms | Circuit: CLOSED
```

**Watch mode** (repeated polling):

```bash
npm run cli -- health --watch --interval-ms 2000 --iterations 10 https://api.mainnet-beta.solana.com
```

**Transaction status** (deterministic with fake transport):

```bash
npm run cli -- status <signature> --endpoint https://api.mainnet-beta.solana.com
```

**Deterministic simulation** (no real RPC):

```bash
npm run cli -- simulate
```

Output shows a complete end-to-end transaction send, fallback scenario, and metrics collection.

**Tests:**

- [`test/cli/health.test.ts`](test/cli/health.test.ts)
- [`test/cli/status.test.ts`](test/cli/status.test.ts)
- [`test/cli/simulate.test.ts`](test/cli/simulate.test.ts)

### Testing and network simulation

The SDK provides deterministic test utilities to simulate failure modes without live RPC:

- **`createFakeRpcTransport`**: Mock RPC endpoint with configurable responses and failure injection.
- **`createFakeRelayClient`**: Mock relay client.
- **`createFakeClock`, `createFakeTimer`, `createFakeRandom`**: Deterministic time and randomness.
- **`simulateNetworkBehavior`**: Inject latency, drops, and errors into transports.

**Example:**

```typescript
import { createFakeRpcTransport, createSdkError, isOk } from "solana-sdk";

const fakeTransport = createFakeRpcTransport({
  endpointUrl: "https://api.test",
  endpointId: "test-endpoint",
  responses: new Map([
    ["sendTransaction", { success: "signature-123" }],
  ]),
});

const sdkResult = createSolanaReliabilitySdk(
  {
    endpoints: ["https://api.test"],
  },
  {
    transports: new Map([["test-endpoint", fakeTransport]]),
  },
);
```

**Test evidence:**

| Area | Test file |
|---|---|
| `@solana/kit` compatibility | [`test/integration/solana-kit-compat.test.ts`](test/integration/solana-kit-compat.test.ts) |
| Wallet Standard adapter | [`test/wallet/standard-wallet.test.ts`](test/wallet/standard-wallet.test.ts) |
| Datadog exporter | [`test/metrics/datadog.test.ts`](test/metrics/datadog.test.ts) |
| CLI health/watch | [`test/cli/health.test.ts`](test/cli/health.test.ts) |
| CLI transaction status | [`test/cli/status.test.ts`](test/cli/status.test.ts) |
| CLI simulation | [`test/cli/simulate.test.ts`](test/cli/simulate.test.ts) |
| Judge demo (MVP showcase) | [`test/integration/final-sdk-demo.test.ts`](test/integration/final-sdk-demo.test.ts) |
| RPC retry/failover | [`test/rpc/resilient-client.test.ts`](test/rpc/resilient-client.test.ts), [`test/integration/rpc-fallback.test.ts`](test/integration/rpc-fallback.test.ts) |
| Relay/Jito fallback | [`test/relay/router.test.ts`](test/relay/router.test.ts), [`test/integration/relay-fallback.test.ts`](test/integration/relay-fallback.test.ts) |
| Network simulation | [`test/integration/rate-limit-circuit-breaker.test.ts`](test/integration/rate-limit-circuit-breaker.test.ts), [`test/testing/network-simulator.test.ts`](test/testing/network-simulator.test.ts) |
| Transaction confirmation timeout | [`test/integration/tx-confirmation-timeout.test.ts`](test/integration/tx-confirmation-timeout.test.ts) |

## Coverage

```
Latest local V8 coverage:
- Statements: 91.89%
- Branches: 85.84%
- Functions: 93.41%
- Lines: 92.53%
```

The project is above 90% coverage for statements and lines. Tests include deterministic network simulation, RPC failures, relay fallback, transaction confirmation polling, priority fee staleness, metrics export, wallet signing, and CLI health checks—all without requiring live Phantom, Datadog, or Jito infrastructure.

## API overview

### Core result/error handling

```typescript
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T };
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E };
export function ok<T>(value: T): Result<T, never>;
export function err<E>(error: E): Result<never, E>;
export function mapResult<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
export function unwrapResult<T, E>(result: Result<T, E>): T;

export type SdkError = { kind: string; message: string; cause?: any };
export function createSdkError(kind: string, message: string, cause?: any): SdkError;
export function isKindOfSdkError(error: any, kind: string): boolean;
export function isRetryableSdkError(error: SdkError): boolean;
```

### RPC reliability

```typescript
export interface RpcEndpointConfig {
  url: string;
  id?: string; // Auto-derived if omitted
}

export interface EndpointRegistry {
  getEndpoint(id: string): RpcEndpointConfig | undefined;
  getAllEndpoints(): RpcEndpointConfig[];
  getState(id: string): RpcEndpointState | undefined;
  getAllStates(): RpcEndpointState[];
}

export function createEndpointRegistry(configs: RpcEndpointConfig[]): Result<EndpointRegistry, SdkError>;
export function selectBestEndpoint(states: RpcEndpointState[]): RpcEndpointState | undefined;
export function createHttpRpcTransport(config: HttpRpcTransportConfig): RpcTransport;
export function createResilientRpcClient(config: ResilientRpcConfig): ResilientRpcClient;
export function executeResilientRpcRequest(client: ResilientRpcClient, ...): Promise<Result<any, SdkError>>;
```

### Transactions

```typescript
export interface PreparedTransaction {
  base64: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export function buildPreparedTransaction(base64: string, blockhash: string, lastValidBlockHeight: number): Result<PreparedTransaction, SdkError>;
export function sendTransactionViaRpc(rpc: RpcTransport, ...): Promise<Result<string, SdkError>>;
export function sendTransactionWithResilience(client: ResilientRpcClient, ...): Promise<Result<string, SdkError>>;
export function pollTransactionConfirmation(rpc: RpcTransport, signature: string, config: ConfirmationConfig): Promise<Result<PollTransactionConfirmationResult, SdkError>>;
export function fetchTransactionStatus(rpc: RpcTransport, signature: string): Promise<Result<TransactionConfirmationStatus, SdkError>>;
```

### Relay / Jito

```typescript
export interface RelayClient {
  readonly name: string;
  sendTransaction(base64: string): Promise<RelaySendResult>;
}

export interface RoutedTransactionResult {
  signature: string;
  route: "relay" | "rpc";
  endpointId?: string;
  relayName?: string;
}

export function createJitoRelayClient(transport: RpcTransport, config: { name: string }): RelayClient;
export function routeTransaction(relay: RelayClient, rpc: RpcTransport, base64: string, ...): Promise<Result<RoutedTransactionResult, SdkError>>;
```

### Fees

```typescript
export interface PriorityFeeEstimate {
  microlamports: number;
  staleness?: { staleMs: number; maxStaleMs: number };
}

export interface PriorityFeeProvider {
  getEstimate(): Promise<Result<PriorityFeeEstimate, SdkError>>;
}

export function createStaticPriorityFeeProvider(microlamports: number): PriorityFeeProvider;
export function createRpcPriorityFeeProvider(rpc: RpcTransport, config: { maxStaleMs: number }): PriorityFeeProvider;
export function getPriorityFeeEstimate(provider: PriorityFeeProvider): Promise<Result<number, SdkError>>;
export function isPriorityFeeStale(estimate: PriorityFeeEstimate): boolean;
```

### Metrics

```typescript
export type MetricEventType = "rpc_attempt" | "relay_attempt" | "transaction_sent" | "transaction_confirmed";

export interface MetricEvent {
  type: MetricEventType;
  timestampMs: number;
  attributes: Record<string, any>;
}

export interface MetricsSink {
  recordEvent(event: MetricEvent): void;
}

export function createInMemoryMetricsSink(): MetricsSink & { getEvents(): MetricEvent[] };
export function createDatadogMetricsSink(config: DatadogMetricsSinkConfig): MetricsSink;
export function createOtelMetricsSink(): MetricsSink & { getEvents(): OtelPayload[] };
export function mapMetricEventToDatadogPayload(event: MetricEvent): any;
export function mapMetricEventToOtelPayload(event: MetricEvent): OtelPayload;
```

### Wallets

```typescript
export interface TransactionWallet {
  publicKey?: string;
  signTransaction(base64: string): Promise<WalletSignResult>;
}

export function createWalletStandardTransactionWallet(wallet: WalletStandardWalletLike): TransactionWallet;
export function signTransactionWithWallet(wallet: TransactionWallet, base64: string): Promise<Result<WalletSignResult, SdkError>>;
export function sendViaWallet(wallet: TransactionWallet, rpc: RpcTransport, ...): Promise<Result<WalletSendResult, SdkError>>;

export const SOLANA_SIGN_TRANSACTION = "solana:signTransaction";
export const SOLANA_SIGN_AND_SEND_TRANSACTION = "solana:signAndSendTransaction";
```

### SDK facade

```typescript
export interface SolanaReliabilitySdk {
  rpc: RpcTransport;
  sendTransaction(base64: string, blockhash: string, lastValidBlockHeight: number, options?: SendTransactionOptions): Promise<Result<string, SdkError>>;
  confirmTransaction(signature: string): Promise<Result<PollTransactionConfirmationResult, SdkError>>;
  getPriorityFee(): Promise<Result<number, SdkError>>;
  getEndpointHealth(): EndpointHealth[];
  recordMetric(event: MetricEvent): void;
}

export function createSolanaReliabilitySdk(config: SolanaReliabilitySdkConfig, deps?: SdkDeps): Result<SolanaReliabilitySdk, SdkError>;
export function validateSdkConfig(config: SolanaReliabilitySdkConfig): Result<void, SdkError>;
```

### Testing utilities

```typescript
export function createFakeClock(): Clock;
export function createFakeTimer(): Timer;
export function createFakeRandom(): RandomSource;
export function createFakeRpcTransport(config: { endpointUrl: string; endpointId: string; responses: Map<string, any> }): RpcTransport & { callCount(method: string): number; getCalls(): any[] };
export function createFakeRelayClient(): RelayClient;
export function simulateNetworkBehavior(transport: RpcTransport, config: { latencyMs?: number; dropRate?: number; errorRate?: number }): RpcTransport;
```

### CLI helpers

```typescript
export function formatEndpointHealth(health: EndpointHealth[]): string;
export function createHealthReport(endpoints: string[]): Promise<Result<string, SdkError>>;
export function createActiveHealthReport(endpoints: string[], options: HealthProbeOptions): Promise<Result<string, SdkError>>;
export function watchHealth(endpoints: string[], options: HealthWatchOptions): Promise<Result<string, SdkError>>;
export function runSimulation(): Promise<string>;
export function formatTransactionStatus(signature: string, status: Result<TransactionConfirmationStatus, SdkError>): string;
export function createTransactionStatusReport(signature: string, endpoint: string): Promise<Result<string, SdkError>>;
```

## Design principles

- **Small, functional modules**: Each module (RPC, TX, Relay, etc.) has a single responsibility.
- **Result-based error handling**: No exceptions; all errors are captured in `Result<T, E>` types.
- **Deterministic testing**: All tests use fakes and local servers, not live network or services.
- **No live network required**: The full test suite runs offline with mocked endpoints, relays, and transports.
- **Wallet signs, SDK sends**: The wallet adapter is responsible only for signing; the SDK handles sending and retry.
- **Observability exporter failures are graceful**: Metrics sink failures don't break transaction sending.
- **Minimal dependencies**: Only `@solana/kit`, `@solana-program/*`, and standard Node.js modules.

## Limitations / non-goals

- **Tests use mocks and local servers**: Datadog tests use a local HTTP server, not real Datadog. Phantom signing is tested with mock Wallet Standard wallets. Jito relay is tested with fake transports.
- **Not a wallet UI framework**: The wallet adapter is for signing and key management integration, not wallet discovery or UI.
- **Wallet discovery/UI is out of scope**: Developers must provide wallet instances; UI is their responsibility.
- **Datadog integration is HTTP-only**: This is a direct `/api/v2/series` exporter, not the full Datadog SDK.
- **Production requires real infrastructure**: Users must provide real RPC endpoints, Datadog API keys, wallet objects, and relay URLs.
- **Deterministic simulation ≠ live network**: The CLI `simulate` command uses fakes for demos; it does not prove behavior on live Mainnet.

## Examples

See [`examples/`](examples/) for runnable demos:

- [`basic.ts`](examples/basic.ts) – Simple SDK usage.
- [`relay-fallback.ts`](examples/relay-fallback.ts) – Relay routing with RPC fallback.
- [`wallet-adapter.ts`](examples/wallet-adapter.ts) – Wallet Standard signing.
- [`judge-demo.ts`](examples/judge-demo.ts) – MVP demo for bounty judges.
- [`devnet-smoke.ts`](examples/devnet-smoke.ts) – Smoke test on Devnet (requires real RPC).

## Final submission note

This repository focuses on a simple, working systems-grade SDK for Solana transaction reliability. The implementation is validated with deterministic tests for RPC failures, network simulation, `@solana/kit` transaction construction, Wallet Standard signing, Datadog metrics export, diagnostics CLI monitoring, transaction status lookup, and relay/RPC fallback. The test suite includes 597 tests across 41 files with 91.89% statement coverage and 92.53% line coverage, covering endpoint failover, retry policies, circuit breakers, priority fee staleness, transaction confirmation polling, and complete end-to-end transaction flow scenarios.
