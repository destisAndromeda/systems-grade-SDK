# Solana Reliability SDK

A compact TypeScript MVP for improving the reliability surface around Solana RPC and transaction submission. It is built around the modular Solana web3.js v2 / `@solana/kit` workflow, Wallet Standard signing, RPC fallback, relay routing, dynamic fees, observability, and deterministic failure simulation.

This project is a compact MVP of a Solana reliability SDK. It focuses on making the core failure paths observable and testable: unhealthy RPC nodes, relay failures, transaction confirmation uncertainty, dynamic fees, and wallet-based signing. The goal was not to build a perfect production transaction engine, but to implement the full reliability surface in a way that is easy to inspect, run, and extend.

## What is included

### SDK compatibility & ecosystem alignment

* **Solana web3.js v2 / `@solana/kit` compatible**: tests build a real `@solana/kit` transaction, serialize it to base64 wire bytes, and send it through the SDK.
* **Functional/modular SDK style**: small TypeScript modules for RPC, transactions, relay, fees, wallet adapters, metrics, CLI, and testing utilities.
* **Plug-and-play Wallet Standard integration**: `createWalletStandardTransactionWallet(...)` adapts Phantom-compatible wallets using `solana:signTransaction`.
* **Wallet signs, SDK sends**: wallets only sign transaction bytes; the SDK owns send, relay/RPC routing, confirmation polling, rebroadcast, fallback, and metrics.

### Advanced resiliency & execution

* **RPC fallback across multiple endpoints** via a resilient RPC transport.
* **Intelligent traffic distribution across healthy nodes** using score-based selection from latency, failure count, recent failures, and circuit state.
* **Circuit breaker / endpoint health tracking** with success/failure counters and open-circuit skipping.
* **Transaction send + confirmation lifecycle** with status polling through `getSignatureStatuses`.
* **SDK-controlled retry / rebroadcast path** for tracked transactions during confirmation.
* **Jito/MEV relay routing** through a relay abstraction, with automatic RPC fallback when enabled.
* **Dynamic priority fee provider** using `getRecentPrioritizationFees`, with static fallback when RPC data is missing, stale, or unavailable.

### Developer experience

* **Metrics + health data** for endpoint latency/failure counters, transaction events, confirmation outcomes, and fee estimates.
* **OpenTelemetry-style and Datadog export** for SDK `MetricEvent` payloads through OTEL mapping and Datadog `/api/v2/series` HTTP payloads.
* **Diagnostics CLI** for RPC health, transaction status, and local failure simulation.
* **Network simulation tests** for latency, drops, relay failures, circuit breaking, fallback behavior, confirmation timeout, and metrics export.

## Architecture

```text
dApp / wallet
  → signed transaction bytes
  → SDK transaction pipeline
  → optional Jito/MEV relay
  → RPC fallback
  → confirmation polling
  → rebroadcast if needed
  → metrics + endpoint health
```

## Quick Start

```bash
npm install
npm test
npm run coverage
npm run build

npm run cli -- simulate
npm run cli -- health https://api.devnet.solana.com
npm run cli -- status <SIGNATURE> --endpoint https://api.devnet.solana.com
```

`package.json` currently names the coverage command `coverage` rather than `test:coverage`.

## Minimal usage

```ts
import { createSolanaReliabilitySdk, isOk } from "solana-reliability-sdk";

const sdkResult = createSolanaReliabilitySdk({
  endpoints: [
    "https://api.devnet.solana.com",
    "https://backup-rpc.example.com",
  ],
  retry: { maxAttempts: 3, baseDelayMs: 100 },
});

if (!isOk(sdkResult)) throw sdkResult.error;

const sdk = sdkResult.value;

const result = await sdk.sendAndConfirmTransaction(
  transactionBase64,
  recentBlockhash,
  lastValidBlockHeight,
  { skipPreflight: true, maxRetries: 0 },
);

if (!isOk(result)) throw result.error;
console.log(result.value.signature, result.value.confirmed);
```

With a Wallet Standard adapter configured, the transaction bytes are signed by the wallet first and then sent through the same SDK pipeline.

```ts
import {
  createSolanaReliabilitySdk,
  createWalletStandardTransactionWallet,
  isOk,
} from "solana-reliability-sdk";

const wallet = createWalletStandardTransactionWallet(phantomWallet);

const sdkResult = createSolanaReliabilitySdk({
  endpoints: ["https://api.devnet.solana.com"],
  wallet,
});

if (!isOk(sdkResult)) throw sdkResult.error;

const sendResult = await sdkResult.value.sendTransaction(
  unsignedTransactionBase64,
  recentBlockhash,
  lastValidBlockHeight,
);

if (!isOk(sendResult)) throw sendResult.error;
console.log(sendResult.value);
```

## Diagnostics CLI

```bash
# Offline deterministic simulation: fallback, endpoint health, and metrics
npm run cli -- simulate

# One-shot RPC health check
npm run cli -- health https://api.devnet.solana.com

# Transaction status lookup
npm run cli -- status <SIGNATURE> --endpoint https://api.devnet.solana.com
```

## Requirement mapping

| Requirement                                                | Where implemented / how to verify                                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public source code                                         | `src/`, `test/`, `examples/`, and this README. Run `npm install` and inspect the modules directly.                                                                                                       |
| Web3.js v2 / `@solana/kit` compatibility verified by tests | `test/integration/solana-kit-compat.test.ts` builds a `@solana/kit` transaction and sends base64 wire bytes through `sdk.sendTransaction(...)`.                                                          |
| Wallet adapter integration                                 | `src/wallet/standard-wallet.ts`, `src/wallet/adapter.ts`, `examples/wallet-adapter.ts`, and `test/wallet/standard-wallet.test.ts`. Wallet signs; SDK sends.                                              |
| Jito/MEV routing implemented and documented                | `src/relay/jito.ts`, `src/relay/router.ts`, `examples/relay-fallback.ts`, `test/relay/router.test.ts`, and `test/integration/relay-fallback.test.ts`.                                                    |
| Observability export working                               | `src/metrics/otel.ts`, `src/metrics/datadog.ts`, `test/metrics/otel.test.ts`, `test/metrics/datadog.test.ts`, and `test/integration/metrics-export.test.ts`.                                             |
| Diagnostics CLI functional                                 | `src/cli/health.ts`, `src/cli/status.ts`, `src/cli/simulate.ts`, plus tests in `test/cli/`. Try `npm run cli -- simulate`.                                                                               |
| 90%+ coverage with network simulation tests                | `src/testing/network-simulator.ts`, `test/testing/network-simulator.test.ts`, and integration tests for RPC fallback, relay fallback, circuit breaker, and confirmation timeout. Run `npm run coverage`. |

## Test and coverage summary

```text
Test Files: 49 passed (49)
Tests:      798 passed (798)

Coverage:
- All files: 91.66% statements
- Branches: 84.56%
- Functions: 93.56%
- Lines: 92.31%
```

Core modules have strong coverage:

| Module    |          Coverage |
| --------- | ----------------: |
| `core`    |              100% |
| `fee`     |              100% |
| `testing` |              100% |
| `rpc`     | 96.24% statements |
| `relay`   | 96.34% statements |
| `metrics` | 96.36% statements |
| `cli`     | 93.14% statements |

## MVP note

This project intentionally prioritizes a compact, inspectable MVP over a perfect production-grade transaction engine. It is designed to improve the reliability surface, provide fallback paths, implement relay/RPC routing, and make important failure paths testable. It does not claim guaranteed transaction landing, guaranteed anti-frontrunning protection, or enterprise-grade production reliability out of the box.

The implementation is meant to be easy for bounty reviewers to run, inspect, and extend.
