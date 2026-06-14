/**
 * SDK factory and initialization.
 *
 * Functions to validate config and create the main SDK facade.
 */

import type { SolanaReliabilitySdkConfig, SolanaReliabilitySdk } from "./types.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";
import type { ResilientRpcConfig, RpcTransport } from "../rpc/types.js";
import type { ConfirmationConfig, PreparedTransaction, SendTransactionOptions, SendTransactionResult } from "../tx/types.js";
import type { PriorityFeeConfig } from "../fee/types.js";
import type { MetricEvent, MetricsSink } from "../metrics/types.js";
import { ok, err, isOk } from "../core/result.js";
import { createSdkError } from "../core/error.js";
import { createSystemClock } from "../core/clock.js";
import { createSystemTimer } from "../core/timer.js";
import { createMathRandomSource as createSystemRandomSource } from "../core/random.js";
import { createEndpointRegistry } from "../rpc/registry.js";
import { createResilientRpcClient } from "../rpc/resilient-client.js";
import { normalizeRpcEndpointConfig, createInitialEndpointState } from "../rpc/endpoint.js";
import { createFakeRpcTransport } from "../testing/fake-transport.js";
import { createHttpRpcTransport } from "../rpc/http-transport.js";
import { buildPreparedTransaction, sendTransactionViaRpc } from "../tx/send.js";
import { pollTransactionConfirmation } from "../tx/confirm.js";
import { createStaticPriorityFeeProvider, createRpcPriorityFeeProvider, getPriorityFeeEstimate } from "../fee/priority-fee.js";
import { createInMemoryMetricsSink } from "../metrics/memory.js";
import { routeTransaction } from "../relay/router.js";
import { sendViaWallet } from "../wallet/adapter.js";

/**
 * Default resilient RPC configuration.
 */
function createDefaultResilientRpcConfig(): ResilientRpcConfig {
  return {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      jitterRatio: 0.1,
    },
    circuitBreaker: {
      failureThreshold: 3,
      openDurationMs: 30000,
    },
    scoring: {
      latencyWeight: 0.3,
      failureWeight: 0.7,
      recentFailurePenalty: 2,
    },
  };
}

/**
 * Default confirmation configuration.
 */
function createDefaultConfirmationConfig(): ConfirmationConfig {
  return {
    commitment: "confirmed",
    pollIntervalMs: 1000,
    timeoutMs: 60000,
  };
}

/**
 * Default priority fee configuration.
 */
function createDefaultPriorityFeeConfig(): PriorityFeeConfig {
  return {
    maxStaleMs: 30000,
    fallbackMicroLamports: 100,
  };
}

/**
 * Validate SDK configuration.
 *
 * Checks that required fields are present and valid.
 *
 * @param config SDK configuration
 * @returns Validation result
 */
export function validateSdkConfig(config: SolanaReliabilitySdkConfig): Result<void, SdkError> {
  // Validate endpoints
  if (!config.endpoints || config.endpoints.length === 0) {
    return err(createSdkError("InvalidConfig", "endpoints must be a non-empty array"));
  }

  // Validate retry config if provided
  if (config.retry) {
    if (config.retry.maxAttempts !== undefined) {
      if (!Number.isInteger(config.retry.maxAttempts) || config.retry.maxAttempts < 1) {
        return err(createSdkError("InvalidConfig", "retry.maxAttempts must be >= 1"));
      }
    }

    if (config.retry.baseDelayMs !== undefined) {
      if (typeof config.retry.baseDelayMs !== "number" || config.retry.baseDelayMs < 0) {
        return err(createSdkError("InvalidConfig", "retry.baseDelayMs must be >= 0"));
      }
    }

    if (config.retry.maxDelayMs !== undefined) {
      if (typeof config.retry.maxDelayMs !== "number" || config.retry.maxDelayMs < 0) {
        return err(createSdkError("InvalidConfig", "retry.maxDelayMs must be >= 0"));
      }
    }
  }

  // Validate circuit breaker config if provided
  if (config.circuitBreaker) {
    if (config.circuitBreaker.failureThreshold !== undefined) {
      if (!Number.isInteger(config.circuitBreaker.failureThreshold) || config.circuitBreaker.failureThreshold < 1) {
        return err(createSdkError("InvalidConfig", "circuitBreaker.failureThreshold must be >= 1"));
      }
    }

    if (config.circuitBreaker.cooldownMs !== undefined) {
      if (typeof config.circuitBreaker.cooldownMs !== "number" || config.circuitBreaker.cooldownMs < 0) {
        return err(createSdkError("InvalidConfig", "circuitBreaker.cooldownMs must be >= 0"));
      }
    }
  }

  // Validate default timeout if provided
  if (config.defaultTimeoutMs !== undefined) {
    if (typeof config.defaultTimeoutMs !== "number" || config.defaultTimeoutMs <= 0) {
      return err(createSdkError("InvalidConfig", "defaultTimeoutMs must be > 0"));
    }
  }

  // Validate confirmation config if provided
  if (config.confirmation) {
    if (config.confirmation.timeoutMs !== undefined) {
      if (typeof config.confirmation.timeoutMs !== "number" || config.confirmation.timeoutMs <= 0) {
        return err(createSdkError("InvalidConfig", "confirmation.timeoutMs must be > 0"));
      }
    }

    if (config.confirmation.pollIntervalMs !== undefined) {
      if (typeof config.confirmation.pollIntervalMs !== "number" || config.confirmation.pollIntervalMs <= 0) {
        return err(createSdkError("InvalidConfig", "confirmation.pollIntervalMs must be > 0"));
      }
    }
  }

  // Validate priority fee config if provided
  if (config.priorityFee) {
    if (config.priorityFee.fallbackMicroLamports !== undefined) {
      if (typeof config.priorityFee.fallbackMicroLamports !== "number" || config.priorityFee.fallbackMicroLamports < 0) {
        return err(createSdkError("InvalidConfig", "priorityFee.fallbackMicroLamports must be >= 0"));
      }
    }

    if (config.priorityFee.maxStaleMs !== undefined) {
      if (typeof config.priorityFee.maxStaleMs !== "number" || config.priorityFee.maxStaleMs < 0) {
        return err(createSdkError("InvalidConfig", "priorityFee.maxStaleMs must be >= 0"));
      }
    }
  }

  return ok(undefined);
}

/**
 * Create a Solana Reliability SDK instance.
 *
 * Initializes the registry, transports, resilience policies,
 * and exposes the high-level SDK facade.
 *
 * @param config SDK configuration
 * @param deps Optional dependency overrides (for testing)
 * @returns SDK instance or error if config invalid
 */
export function createSolanaReliabilitySdk(
  config: SolanaReliabilitySdkConfig,
  deps?: {
    clock?: { now(): number };
    timer?: { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void };
    random?: { next(): number };
    transports?: Map<string, RpcTransport>;
  },
): Result<SolanaReliabilitySdk, SdkError> {
  // Validate config
  const validationResult = validateSdkConfig(config);
  if (!validationResult.ok) {
    return validationResult;
  }

  // Use provided dependencies or create defaults
  const clock = deps?.clock ?? createSystemClock();
  const timer = deps?.timer ?? createSystemTimer();
  const random = deps?.random ?? createSystemRandomSource();

  // Create endpoint registry
  const registryResult = createEndpointRegistry(config.endpoints);
  if (!registryResult.ok) {
    return registryResult as Result<SolanaReliabilitySdk, SdkError>;
  }
  const registry = registryResult.value;

  // Create or receive transports
  let transports: Map<string, RpcTransport>;
  if (deps?.transports) {
    transports = deps.transports;
  } else {
    // Create HTTP transports for production use
    transports = new Map();
    for (const endpoint of registry.getAll()) {
      const transport = createHttpRpcTransport({
        endpointUrl: endpoint.config.url,
        endpointId: endpoint.id,
        ...(endpoint.config.headers ? { headers: endpoint.config.headers } : {}),
      });
      transports.set(endpoint.id, transport);
    }
  }

  // Merge resilient RPC config with defaults
  const defaultRpcConfig = createDefaultResilientRpcConfig();
  const rpcConfig: ResilientRpcConfig = {
    retry: {
      maxAttempts: config.retry?.maxAttempts ?? defaultRpcConfig.retry.maxAttempts,
      baseDelayMs: config.retry?.baseDelayMs ?? defaultRpcConfig.retry.baseDelayMs,
      maxDelayMs: config.retry?.maxDelayMs ?? defaultRpcConfig.retry.maxDelayMs,
      jitterRatio: config.retry?.jitterRatio ?? defaultRpcConfig.retry.jitterRatio,
    },
    circuitBreaker: {
      failureThreshold: config.circuitBreaker?.failureThreshold ?? defaultRpcConfig.circuitBreaker.failureThreshold,
      openDurationMs: config.circuitBreaker?.cooldownMs ?? defaultRpcConfig.circuitBreaker.openDurationMs,
    },
    scoring: defaultRpcConfig.scoring,
  };

  if (config.defaultTimeoutMs !== undefined) {
    rpcConfig.defaultTimeoutMs = config.defaultTimeoutMs;
  }

  // Create resilient RPC client
  const rpcTransport = createResilientRpcClient(transports, rpcConfig, {
    registry,
    clock,
    timer,
    random,
  });

  // Merge confirmation config with defaults
  const defaultConfirmationConfig = createDefaultConfirmationConfig();
  const confirmationConfig: ConfirmationConfig = {
    commitment: config.confirmation?.commitment ?? defaultConfirmationConfig.commitment,
    pollIntervalMs: config.confirmation?.pollIntervalMs ?? defaultConfirmationConfig.pollIntervalMs,
    timeoutMs: config.confirmation?.timeoutMs ?? defaultConfirmationConfig.timeoutMs,
  } as ConfirmationConfig;

  // Merge priority fee config with defaults
  const defaultPriorityFeeConfig = createDefaultPriorityFeeConfig();
  const priorityFeeConfig: PriorityFeeConfig = {
    maxStaleMs: config.priorityFee?.maxStaleMs ?? defaultPriorityFeeConfig.maxStaleMs,
    fallbackMicroLamports: config.priorityFee?.fallbackMicroLamports ?? defaultPriorityFeeConfig.fallbackMicroLamports,
  };

  // Create priority fee providers
  const feeProviders = [
    createRpcPriorityFeeProvider(rpcTransport, clock),
    createStaticPriorityFeeProvider(priorityFeeConfig.fallbackMicroLamports, clock),
  ];

  // Metrics sink - use provided or create in-memory
  const metricsResult = config.metrics ?? createInMemoryMetricsSink();

  return ok(
    new SolanaReliabilitySdkImpl(
      rpcTransport,
      registry,
      confirmationConfig,
      priorityFeeConfig,
      feeProviders,
      config.relay,
      config.relayRouting,
      config.wallet,
      metricsResult,
      { clock, timer },
    ),
  );
}

/**
 * SDK implementation.
 */
class SolanaReliabilitySdkImpl implements SolanaReliabilitySdk {
  rpc: RpcTransport;

  constructor(
    rpc: RpcTransport,
    private registry: any,
    private confirmationConfig: ConfirmationConfig,
    private priorityFeeConfig: PriorityFeeConfig,
    private feeProviders: any[],
    private relay: any,
    private relayRouting: any,
    private wallet: any,
    private metricsSink: MetricsSink & { getEvents?(): MetricEvent[] },
    private deps: { clock: any; timer: any },
  ) {
    this.rpc = rpc;
  }

  async sendTransaction(
    base64: string,
    blockhash: string,
    lastValidBlockHeight: number,
    options?: SendTransactionOptions,
  ): Promise<Result<string, SdkError>> {
    try {
      // Build and validate transaction
      const buildResult = buildPreparedTransaction(base64, blockhash, lastValidBlockHeight);
      if (!buildResult.ok) {
        return buildResult as Result<string, SdkError>;
      }

      const prepared = buildResult.value;

      // Record metric
      this.metricsSink.record({
        type: "tx_send",
        timestampMs: this.deps.clock.now(),
      });

      // Route: wallet -> relay -> RPC
      if (this.wallet) {
        const walletResult = await sendViaWallet(this.wallet, this.rpc, prepared, options);
        if (walletResult.ok) {
          return ok(walletResult.value.signature);
        }
        return walletResult as Result<string, SdkError>;
      }

      if (this.relay && this.relayRouting) {
        const routeResult = await routeTransaction(prepared, this.relay, this.rpc, this.relayRouting, options);
        if (routeResult.ok) {
          return ok(routeResult.value.signature);
        }
        return routeResult as Result<string, SdkError>;
      }

      // Default: send via RPC
      const sendResult = await sendTransactionViaRpc(this.rpc, prepared, options);
      if (sendResult.ok) {
        return ok(sendResult.value.signature);
      }
      return sendResult as Result<string, SdkError>;
    } catch (error: unknown) {
      const sdkError = error instanceof Error && (error as any).kind ? (error as SdkError) : createSdkError("Unknown", String(error));
      return err(sdkError);
    }
  }

  async confirmTransaction(
    signature: string,
    config?: Partial<ConfirmationConfig>,
  ): Promise<Result<{ confirmed: boolean; slot?: number }, SdkError>> {
    try {
      // Merge config overrides
      const finalConfig: ConfirmationConfig = {
        pollIntervalMs: config?.pollIntervalMs ?? this.confirmationConfig.pollIntervalMs,
        timeoutMs: config?.timeoutMs ?? this.confirmationConfig.timeoutMs,
      };
      if (config?.commitment !== undefined) {
        finalConfig.commitment = config.commitment;
      } else if (this.confirmationConfig.commitment !== undefined) {
        finalConfig.commitment = this.confirmationConfig.commitment;
      }

      // Poll for confirmation
      const pollResult = await pollTransactionConfirmation(this.rpc, signature, finalConfig, {
        timer: this.deps.timer,
        clock: this.deps.clock,
      });

      if (pollResult.ok) {
        const status = pollResult.value.status;
        const confirmed = status.kind === "confirmed" || status.kind === "finalized";

        // Record metric
        this.metricsSink.record({
          type: confirmed ? "tx_confirmed" : "tx_timeout",
          timestampMs: this.deps.clock.now(),
        });

        const result: { confirmed: boolean; slot?: number } = {
          confirmed,
        };

        if (status.kind !== "pending" && status.slot !== undefined) {
          result.slot = status.slot;
        }

        return ok(result);
      }

      // Record timeout metric
      this.metricsSink.record({
        type: "tx_timeout",
        timestampMs: this.deps.clock.now(),
      });

      return pollResult as Result<{ confirmed: boolean; slot?: number }, SdkError>;
    } catch (error: unknown) {
      const sdkError = error instanceof Error && (error as any).kind ? (error as SdkError) : createSdkError("Unknown", String(error));
      return err(sdkError);
    }
  }

  async getPriorityFee(): Promise<Result<number, SdkError>> {
    try {
      // Get fee estimate from providers
      const estimateResult = await getPriorityFeeEstimate(this.feeProviders, this.priorityFeeConfig, this.deps.clock);

      if (estimateResult.ok) {
        const estimate = estimateResult.value;
        // Record metric
        this.metricsSink.record({
          type: "fee_estimate",
          timestampMs: this.deps.clock.now(),
          attributes: {
            source: estimate.source,
          },
        });

        return ok(estimate.priorityFeeMicroLamports);
      }

      // Error from fee estimation
      return estimateResult as Result<number, SdkError>;
    } catch (error: unknown) {
      const sdkError = error instanceof Error && (error as any).kind ? (error as SdkError) : createSdkError("Unknown", String(error));
      return err(sdkError);
    }
  }

  getEndpointHealth(): Array<{
    id: string;
    url: string;
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    avgLatencyMs: number;
    circuitOpen: boolean;
  }> {
    const now = this.deps.clock.now();
    return this.registry.getAll().map((state: any) => ({
      id: state.id,
      url: state.config.url,
      successCount: state.successCount,
      failureCount: state.failureCount,
      consecutiveFailures: state.consecutiveFailures,
      avgLatencyMs: state.avgLatencyMs,
      circuitOpen: (state.circuitOpenUntil ?? 0) > now,
    }));
  }

  getMetrics(): MetricEvent[] {
    if (typeof (this.metricsSink as any).getEvents === "function") {
      return (this.metricsSink as any).getEvents();
    }
    return [];
  }
}
