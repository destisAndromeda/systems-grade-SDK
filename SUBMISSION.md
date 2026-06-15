# Submission Summary

This project is a compact MVP of a Solana reliability SDK. It focuses on making the core failure paths observable and testable: unhealthy RPC nodes, relay failures, transaction confirmation uncertainty, dynamic fees, and wallet-based signing. The goal was not to build a perfect production transaction engine, but to implement the full reliability surface in a way that is easy to inspect, run, and extend.

The SDK is designed to improve Solana transaction submission reliability by keeping wallet signing separate from SDK-controlled sending, relay/RPC routing, confirmation polling, rebroadcast, endpoint health, metrics, and diagnostics.

## Requirement Mapping

| Requirement                                                            | Implementation                                                                                                                     | How to verify                                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Public GitHub repo with all source code                                | Repository includes `src/`, `test/`, `examples/`, `README.md`, `package.json`, and TypeScript config.                              | Inspect the submitted GitHub repo root and run the commands below.                                                            |
| Web3.js v2.0 / `@solana/kit` compatibility verified with tests         | Modular Solana transaction flow is tested through `@solana/kit` wire bytes.                                                        | See `test/integration/solana-kit-compat.test.ts`; run `npm test`.                                                             |
| Wallet adapter / Wallet Standard-compatible flow                       | Wallet Standard adapter signs via `solana:signTransaction`; legacy wallet adapter bridge is also present. Wallet signs, SDK sends. | See `src/wallet/standard-wallet.ts`, `src/wallet/adapter.ts`, `examples/wallet-adapter.ts`, `test/wallet/*.test.ts`.          |
| Jito/MEV routing implemented and documented                            | Jito relay client plus relay-first router with route metadata.                                                                     | See `src/relay/jito.ts`, `src/relay/router.ts`, `examples/relay-fallback.ts`, `test/relay/*.test.ts`.                         |
| RPC fallback when relay fails                                          | Relay router falls back to RPC when `fallbackToRpc` is enabled.                                                                    | See `src/relay/router.ts` and `test/integration/relay-fallback.test.ts`.                                                      |
| Dynamic external fee estimates / priority fee estimation with fallback | RPC provider calls `getRecentPrioritizationFees`; static fallback is used when data is unavailable, invalid, or stale.             | See `src/fee/priority-fee.ts` and `test/fee/priority-fee.test.ts`.                                                            |
| Intelligent traffic distribution across healthy nodes                  | Resilient RPC client selects endpoints using health/scoring state and skips open circuits.                                         | See `src/rpc/resilient-client.ts`, `src/rpc/scoring.ts`, `src/rpc/registry.ts`, `src/rpc/circuit-breaker.ts`.                 |
| RPC metrics: latency, failures, tx events                              | Endpoint state tracks latency/failures; SDK emits tx, confirmation, timeout, fee, retry, circuit, and RPC events.                  | See `src/rpc/endpoint.ts`, `src/metrics/types.ts`, `src/sdk/create-sdk.ts`, `test/metrics/*.test.ts`.                         |
| OpenTelemetry-style and/or Datadog exporter                            | OTEL-style payload mapper/sink and Datadog v2 series payload/export sink.                                                          | See `src/metrics/otel.ts`, `src/metrics/datadog.ts`, `test/integration/metrics-export.test.ts`.                               |
| Diagnostics CLI functional                                             | CLI supports RPC health checks, transaction status lookup, and local simulation.                                                   | Run `npm run cli -- simulate`, `health`, and `status`; see `src/cli/*`, `test/cli/*.test.ts`.                                 |
| Real-time-ish monitoring / watch mode                                  | RPC health command has `--watch`, `--interval-ms`, and bounded `--iterations` support.                                             | Run `npm run cli -- health --watch --interval-ms 2000 --iterations 5 https://api.devnet.solana.com`; see `src/cli/health.ts`. |
| 90%+ test coverage with network simulation tests                       | Coverage is above 90% statements/lines; tests include deterministic RPC/relay/network failure simulation.                          | Run `npm run coverage`; see `src/testing/*`, `test/testing/*`, and integration tests.                                         |

## Architecture

```text
dApp / wallet
  → signed transaction bytes
  → SDK transaction pipeline
  → optional Jito/MEV relay route
  → RPC fallback
  → confirmation polling
  → rebroadcast if needed
  → metrics + endpoint health updates
```

Module responsibilities:

| Area                  | Files                                       | Responsibility                                                                                                          |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| SDK facade            | `src/sdk/create-sdk.ts`, `src/sdk/types.ts` | Config validation, SDK construction, send/confirm API, wallet/relay/RPC wiring, metrics access.                         |
| RPC resilience        | `src/rpc/*`                                 | Endpoint registry, HTTP transport, retry, timeout, error classification, scoring, circuit breaker, fallback.            |
| Transaction lifecycle | `src/tx/*`                                  | Prepared transaction validation, preflight guard, raw send, confirmation polling, rebroadcast, expiry/timeout handling. |
| Relay routing         | `src/relay/*`                               | Jito relay adapter, relay-first routing, RPC fallback, route result metadata.                                           |
| Fees                  | `src/fee/*`                                 | Priority fee estimates from RPC plus static fallback.                                                                   |
| Wallets               | `src/wallet/*`                              | Wallet Standard signing and legacy adapter bridge; wallet signs while SDK sends.                                        |
| Metrics               | `src/metrics/*`                             | In-memory metrics plus OTEL-style and Datadog exporters.                                                                |
| CLI diagnostics       | `src/cli/*`                                 | Health, health watch mode, transaction status, and local simulation commands.                                           |
| Testing utilities     | `src/testing/*`                             | Fake transport, fake relay, fake clock/timer/random, and network simulator.                                             |

## Testing & Coverage

```text
Test Files: 49 passed (49)
Tests: 798 passed (798)
```

Coverage:

* Statements: 91.66%
* Branches: 84.56%
* Functions: 93.56%
* Lines: 92.31%

Strong module coverage:

* `core`: 100%
* `fee`: 100%
* `testing`: 100%
* `rpc`: 96.24% statements
* `relay`: 96.34% statements
* `metrics`: 96.36% statements
* `cli`: 93.14% statements

Test surface includes fake transports, fake relay, fake clock/timer/random, network simulator, latency/drop/failure simulation, relay fallback tests, transaction lifecycle tests, wallet tests, metrics tests, CLI tests, and `@solana/kit` compatibility tests.

## How to Run

```bash
npm install
npm test
npm run coverage
npm run build
```

CLI examples:

```bash
npm run cli -- simulate
npm run cli -- health https://api.devnet.solana.com
npm run cli -- health --watch --interval-ms 2000 --iterations 5 https://api.devnet.solana.com
npm run cli -- status <SIGNATURE> --endpoint https://api.devnet.solana.com
```

Note: the current `package.json` script is `npm run coverage`; `npm run test:coverage` is not defined.

## MVP Scope / Limitations

* This is an MVP focused on the required reliability surfaces, not a production-grade transaction engine.
* Jito/MEV routing is implemented as relay-first routing with RPC fallback, not as a complete production MEV strategy.
* The SDK is designed to improve reliability under simulated RPC, relay, and network failures, but it does not claim perfect delivery guarantees.
* The implementation is intentionally compact, inspectable, and extendable.

## Judging Criteria Notes

**Correctness**

* Tested fallback, confirmation polling, relay failure handling, fee fallback, wallet signing, and `@solana/kit` transaction compatibility.

**Resilience Quality**

* Endpoint scoring, circuit breaker, retry/backoff, traffic distribution across healthy nodes, rebroadcast, and confirmation/expiry handling.

**Developer Experience**

* Compact SDK API, Wallet Standard adapter, legacy wallet adapter bridge, metrics exporters, diagnostics CLI, and deterministic local simulation tools.

**Test Coverage**

* 798 tests across 49 files.
* 91.66% statement coverage and 92.31% line coverage.
* Network simulation tests cover drops, latency, relay failures, fallback behavior, confirmation timeouts, and observability paths.
