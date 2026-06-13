/**
 * Network simulator for testing resilience.
 *
 * Allows tests to inject simulated failures (latency, timeouts, drops)
 * into network calls without modifying the underlying code.
 */

import type { RpcTransport } from "../rpc/types.js";
import type { Clock } from "../core/clock.js";
import type { Timer } from "../core/timer.js";
import type { RandomSource } from "../core/random.js";
import { createSdkError } from "../core/error.js";

/**
 * Network simulation configuration.
 */
export interface NetworkSimConfig {
  latencyMs?: number; // Add latency to calls
  dropRate?: number; // Probability of dropping packet [0, 1]
  failRate?: number; // Probability of failure [0, 1]
  failureError?: Error; // Error to return on failure
  timeoutMs?: number; // Timeout for the call
}

/**
 * Simulate network behavior on a transport.
 *
 * Wraps an existing transport to inject latency, drops, and failures.
 *
 * @param transport Original transport
 * @param config Simulation configuration
 * @param deps.clock Clock for measuring time
 * @param deps.timer Timer for delays
 * @param deps.random Random source for drop/fail rates
 * @returns Wrapped transport with simulated behavior
 */
export function simulateNetworkBehavior(
  transport: RpcTransport,
  config: NetworkSimConfig,
  deps: { clock: Clock; timer: Timer; random: RandomSource },
): RpcTransport {
  return {
    endpointUrl: transport.endpointUrl,
    endpointId: transport.endpointId,

    async send<TParams, TResult>(
      method: string,
      params: TParams,
      options?: { timeoutMs?: number },
    ): Promise<TResult> {
      // Apply latency if configured
      if (config.latencyMs !== undefined && config.latencyMs > 0) {
        await new Promise<void>((resolve) => {
          deps.timer.setTimeout(resolve, config.latencyMs!);
        });
      }

      // Simulate drop as timeout
      if (config.dropRate !== undefined && config.dropRate > 0) {
        const randomValue = deps.random.next();
        if (randomValue < config.dropRate) {
          throw createSdkError("Timeout", "Simulated dropped RPC request", { retryable: true });
        }
      }

      // Simulate failure
      if (config.failRate !== undefined && config.failRate > 0) {
        const randomValue = deps.random.next();
        if (randomValue < config.failRate) {
          if (config.failureError !== undefined) {
            throw config.failureError;
          } else {
            throw createSdkError("NetworkError", "Simulated network failure");
          }
        }
      }

      // Determine timeout for wrapped call
      const timeoutMs = options?.timeoutMs ?? config.timeoutMs;

      // Delegate to wrapped transport
      return transport.send<TParams, TResult>(method, params, timeoutMs !== undefined ? { timeoutMs } : undefined);
    },
  };
}
