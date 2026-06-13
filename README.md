# Solana Reliability SDK

A lightweight, systems-grade SDK that improves RPC and transaction reliability for Solana dApps.

## What It Does

The Solana Reliability SDK wraps RPC and transaction flows with production-ready resilience:

- **RPC Endpoint Fallback**: Automatically retry failed requests across multiple endpoints
- **Retry with Backoff**: Exponential backoff with jitter for transient failures
- **Timeout Handling**: Configurable request timeouts prevent hanging requests
- **Circuit Breaker**: Prevent cascading failures by temporarily disabling failing endpoints
- **Transaction Send + Confirmation**: Full end-to-end transaction lifecycle management
- **Priority Fee Estimation**: Get current network fees or fall back to static values
- **Relay Support**: Optional MEV relay integration with automatic RPC fallback
- **Wallet Adapter**: Sign transactions with custom wallet implementations
- **Metrics & Health**: Track endpoint performance and observe system behavior
- **Deterministic Testing**: Fake transports for reliable, repeatable tests

## Installation

```bash
npm install solana-sdk
# or
yarn add solana-sdk
# or clone and use locally
```

## Quick Start

```typescript
import { createSolanaReliabilitySdk, isOk } from "solana-sdk";

// Create SDK with endpoints
const sdkResult = createSolanaReliabilitySdk({
  endpoints: [
    "https://api.mainnet-beta.solana.com",
    "https://backup.rpc.solana.com",
  ],
});

if (!isOk(sdkResult)) {
  console.error("SDK error:", sdkResult.error);
  process.exit(1);
}

const sdk = sdkResult.value;

// Send a transaction (with automatic retry and fallback)
const base64 = "...base64-encoded-tx...";
const blockhash = "...recent-blockhash...";
const lastValidBlockHeight = 12345;

const sendResult = await sdk.sendTransaction(base64, blockhash, lastValidBlockHeight);
if (isOk(sendResult)) {
  console.log("Sent:", sendResult.value);
  
  // Confirm the transaction
  const confirmResult = await sdk.confirmTransaction(sendResult.value);
  if (isOk(confirmResult)) {
    console.log("Confirmed:", confirmResult.value);
  }
}
```

## RPC Fallback Example

```typescript
// First endpoint fails → automatically tries second endpoint
const sdkResult = createSolanaReliabilitySdk({
  endpoints: [
    "https://primary-rpc.example.com",      // Might fail
    "https://backup-rpc.example.com",       // Fallback
  ],
  retry: {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
  },
});

const sdk = sdkResult.value;
const result = await sdk.rpc.call("getBalance", [wallet]);

// ✓ If primary fails, SDK automatically retries with backup
// ✓ Failures tracked for circuit breaker
// ✓ Metrics recorded for observability
```

## Transaction Flow

```typescript
// 1. Prepare transaction
const prepared = await sdk.sendTransaction(
  base64,
  blockhash,
  lastValidBlockHeight,
  { skipPreflight: false }
);

// 2. Poll for confirmation (with configurable commitment level)
const confirmed = await sdk.confirmTransaction(signature, {
  commitment: "confirmed",
  pollIntervalMs: 1000,
  timeoutMs: 60000,
});

// 3. Check health and metrics
const health = sdk.getEndpointHealth();
const metrics = sdk.getMetrics();
```

## Relay Integration

```typescript
import { createJitoRelayClient } from "solana-sdk";

const jito = createJitoRelayClient("jito-relay", rpcTransport);

const sdkResult = createSolanaReliabilitySdk({
  endpoints: ["https://api.mainnet-beta.solana.com"],
  relay: jito,
  relayRouting: {
    preferRelay: true,        // Try relay first
    fallbackToRpc: true,      // Fall back to RPC if relay fails
  },
});
```

## Wallet Adapter

```typescript
// Implement the TransactionWallet interface
const wallet: TransactionWallet = {
  signTransaction: async (base64) => {
    // Sign the transaction with your wallet
    return {
      signedBase64: "...signed-tx...",
      publicKey: "...wallet-pubkey...",
    };
  },
};

const sdkResult = createSolanaReliabilitySdk({
  endpoints: ["https://api.mainnet-beta.solana.com"],
  wallet,
});

// SDK will automatically sign and send via wallet
const result = await sdk.sendTransaction(base64, blockhash, height);
```

## Metrics & Observability

```typescript
// Get endpoint health information
const health = sdk.getEndpointHealth();
for (const endpoint of health) {
  console.log(`${endpoint.id}:`);
  console.log(`  Success: ${endpoint.successCount}`);
  console.log(`  Failures: ${endpoint.failureCount}`);
  console.log(`  Avg Latency: ${endpoint.avgLatencyMs}ms`);
  console.log(`  Circuit: ${endpoint.circuitOpen ? "OPEN" : "CLOSED"}`);
}

// Get recorded metrics
const metrics = sdk.getMetrics();
for (const metric of metrics) {
  console.log(`${metric.type} at ${metric.timestampMs}`);
}
```

## CLI Commands

The SDK includes a simple CLI for testing and demonstration:

```bash
# Check RPC endpoint health
npm run cli -- health https://api.mainnet-beta.solana.com https://backup.rpc.solana.com

# Run reliability simulation with fake transports
npm run cli -- simulate
```

## Examples

Ready-to-run examples demonstrating key features:

- **[basic.ts](examples/basic.ts)** — Basic SDK usage: send, confirm, fees, health
- **[relay-fallback.ts](examples/relay-fallback.ts)** — MEV relay with RPC fallback
- **[wallet-adapter.ts](examples/wallet-adapter.ts)** — Transaction signing with wallet
- **[judge-demo.ts](examples/judge-demo.ts)** — Complete MVP reliability story

Run examples:

```bash
npm run example:basic
npm run example:relay-fallback
npm run example:wallet-adapter
npm run example:demo
```

## Testing

```bash
# Run full test suite
npm test

# Run with coverage
npm run coverage

# Type check
npm run typecheck
```

## Configuration

### Retry Policy

```typescript
{
  retry: {
    maxAttempts: 3,           // Max retry attempts
    baseDelayMs: 100,         // Initial backoff delay
    maxDelayMs: 5000,         // Max backoff delay
    jitterRatio: 0.1,         // Jitter factor (0-1)
  }
}
```

### Circuit Breaker

```typescript
{
  circuitBreaker: {
    failureThreshold: 3,      // Failures to open circuit
    cooldownMs: 30000,        // Duration before retry
  }
}
```

### Confirmation

```typescript
{
  confirmation: {
    commitment: "confirmed",  // "processed" | "confirmed" | "finalized"
    pollIntervalMs: 1000,     // Poll frequency
    timeoutMs: 60000,         // Total timeout
  }
}
```

### Priority Fee

```typescript
{
  priorityFee: {
    maxStaleMs: 30000,        // Max age of cached fee estimate
    fallbackMicroLamports: 100, // Fallback fee if estimate fails
  }
}
```

## Limitations

This MVP is intentionally focused and simple:

- **No real Solana RPC calls** — Examples use fake transports for determinism
- **No real Jito integration** — Relay client delegates to RPC transport
- **No real wallet SDK** — Examples show adapter pattern for custom wallets
- **No production OTEL exporter** — Metrics sink is in-memory only
- **No interactive CLI** — Simple argument parsing, no prompts or config files

For production deployment, integrate with real RPC endpoints, wallet providers, and observability systems.

## Error Handling

The SDK uses `Result<T, E>` types for safe error handling:

```typescript
const result = await sdk.sendTransaction(base64, blockhash, height);

if (isOk(result)) {
  // Success path
  const signature = result.value;
  console.log("Sent:", signature);
} else {
  // Error path
  const error = result.error;
  console.error(`${error.kind}: ${error.message}`);
  
  // Check error kind for specific handling
  if (isKindOfSdkError(error, "NetworkError")) {
    // Retryable network error
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Solana Reliability SDK                 │
├─────────────────────────────────────────────────────────┤
│  sendTransaction() + confirmTransaction() [Facade]     │
│  getPriorityFee() + getEndpointHealth() + getMetrics() │
├─────────────────────────────────────────────────────────┤
│  RPC Resilience          Relay Router          Wallet   │
│  - Retry + Backoff       - Relay → RPC        - Signing │
│  - Circuit Breaker       - Fallback Logic                │
│  - Timeout Handling                                      │
├─────────────────────────────────────────────────────────┤
│  Transaction Flow        Endpoint Registry    Metrics   │
│  - Send + Confirm        - Health Tracking   - Events   │
│  - Polling                                               │
├─────────────────────────────────────────────────────────┤
│  RPC Transport           Fake Transport (Testing)       │
│  - Real or Fake          - Deterministic behavior       │
│  - Pluggable             - For reliable tests            │
└─────────────────────────────────────────────────────────┘
```

## Key Features

| Feature | Status | Notes |
|---------|--------|-------|
| RPC endpoint fallback | ✓ | Multi-endpoint retry with scoring |
| Circuit breaker | ✓ | Prevent cascading failures |
| Retry with backoff | ✓ | Exponential backoff with jitter |
| Timeout handling | ✓ | Configurable request timeouts |
| Transaction send | ✓ | Build, validate, send to RPC |
| Transaction confirm | ✓ | Poll with commitment level |
| Priority fee estimate | ✓ | RPC provider + static fallback |
| Relay integration | ✓ | Jito relay adapter + RPC fallback |
| Wallet adapter | ✓ | Sign with custom wallet |
| Metrics | ✓ | In-memory event recording |
| Health reporting | ✓ | Per-endpoint stats |
| Type safety | ✓ | TypeScript strict mode |
| Testing support | ✓ | Fake transports + deterministic |

## Development

```bash
# Install dependencies
npm install

# Build types
npm run typecheck

# Run tests (watch mode)
npm run test:watch

# Run tests (once)
npm test

# Coverage report
npm run coverage
```

## License

ISC

## Resources

- [Vitest Testing Guide](https://vitest.dev/guide/learn/writing-tests.html)
- [Solana Docs](https://docs.solana.com)
- [Solana Kit](https://www.solanakit.com/docs)
