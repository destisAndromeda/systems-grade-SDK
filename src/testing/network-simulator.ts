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
  // TODO: wrap transport to inject latency, drops, and failures
  throw new Error("TODO");
}
