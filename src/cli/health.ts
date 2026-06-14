/**
 * Health check command.
 *
 * Checks the status of RPC endpoints and reports their health.
 * Supports one-shot and watch/polling modes with injectable deps for testing.
 */

import type { RpcTransport } from "../rpc/types.js";
import { createSolanaReliabilitySdk } from "../sdk/create-sdk.js";
import { isOk } from "../core/result.js";

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

/**
 * Options for a single active health probe.
 */
export interface HealthProbeOptions {
  /** Maximum time in ms to wait for the probe response. */
  timeoutMs?: number;
  /** RPC method to use for probing. Defaults to "getHealth". */
  probeMethod?: "getHealth" | "getSlot";
}

/**
 * Options for watch / polling mode.
 */
export interface HealthWatchOptions extends HealthProbeOptions {
  /** If true, poll repeatedly until process is killed (or iterations is reached). */
  watch?: boolean;
  /** Milliseconds between poll iterations. Defaults to 2000. */
  intervalMs?: number;
  /** Maximum number of iterations (useful for tests). Omit for infinite. */
  iterations?: number;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/**
 * Format endpoint health data into a human-readable report.
 *
 * @param health Array of endpoint health data
 * @returns Formatted multiline health report string
 */
export function formatEndpointHealth(
  health: Array<{
    id: string;
    url: string;
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    avgLatencyMs: number;
    circuitOpen: boolean;
  }>,
): string {
  if (health.length === 0) {
    return "No endpoints configured.";
  }

  const lines: string[] = [];
  lines.push("=== RPC Endpoint Health ===\n");

  for (const endpoint of health) {
    lines.push(`Endpoint: ${endpoint.id}`);
    lines.push(`  URL: ${endpoint.url}`);
    lines.push(`  Success: ${endpoint.successCount} | Failures: ${endpoint.failureCount}`);
    lines.push(`  Consecutive Failures: ${endpoint.consecutiveFailures}`);
    lines.push(`  Avg Latency: ${endpoint.avgLatencyMs.toFixed(1)}ms`);
    lines.push(`  Circuit: ${endpoint.circuitOpen ? "OPEN" : "CLOSED"}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// One-shot (sync, backward-compatible)
// ---------------------------------------------------------------------------

/**
 * Create a health report for given endpoints (synchronous, no network calls).
 *
 * Creates an SDK instance with the provided endpoints and reports their health status.
 * Kept for backward compatibility; counters will show zero because no probe is issued.
 *
 * @param endpointUrls Array of RPC endpoint URLs
 * @returns Health report as formatted text string
 */
export function createHealthReport(endpointUrls: string[]): string {
  if (!endpointUrls || endpointUrls.length === 0) {
    return `Usage: solana-reliability-sdk health <endpoint1> [endpoint2] ...\n\nExample:\n  solana-reliability-sdk health https://api.mainnet-beta.solana.com https://backup.rpc.solana.com`;
  }

  // Create SDK with endpoints
  const sdkResult = createSolanaReliabilitySdk({
    endpoints: endpointUrls,
  });

  if (!isOk(sdkResult)) {
    return `Error creating SDK: ${sdkResult.error.message}`;
  }

  const sdk = sdkResult.value;

  // Get endpoint health
  const health = sdk.getEndpointHealth();

  // Format and return health report
  return formatEndpointHealth(health);
}

// ---------------------------------------------------------------------------
// Active one-shot probe
// ---------------------------------------------------------------------------

/**
 * Create a health report that first issues a real RPC probe so endpoint
 * success/failure counters are updated before the report is printed.
 *
 * @param endpointUrls Array of RPC endpoint URLs
 * @param options Probe options (timeout, method)
 * @param deps Injected dependencies – use in tests to supply fake transports
 * @returns Formatted health report string (never throws)
 */
export async function createActiveHealthReport(
  endpointUrls: string[],
  options?: HealthProbeOptions,
  deps?: {
    transports?: Map<string, RpcTransport>;
  },
): Promise<string> {
  if (!endpointUrls || endpointUrls.length === 0) {
    return `Usage: solana-reliability-sdk health <endpoint1> [endpoint2] ...\n\nExample:\n  solana-reliability-sdk health https://api.mainnet-beta.solana.com https://backup.rpc.solana.com`;
  }

  // Build SDK (injected transports override real HTTP transports in tests)
  const sdkResult = createSolanaReliabilitySdk(
    { endpoints: endpointUrls },
    deps?.transports ? { transports: deps.transports } : undefined,
  );

  if (!isOk(sdkResult)) {
    return `Error creating SDK: ${sdkResult.error.message}`;
  }

  const sdk = sdkResult.value;
  const method = options?.probeMethod ?? "getHealth";

  // Issue one probe through the resilient RPC transport so the registry
  // success/failure counters are updated before we read them.
  let probeLabel: string;
  try {
    await sdk.rpc.send(method, [], options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : undefined);
    probeLabel = "ok";
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    probeLabel = `error ${msg}`;
  }

  const health = sdk.getEndpointHealth();
  const report = formatEndpointHealth(health);
  return `${report}Probe: ${probeLabel}\n`;
}

// ---------------------------------------------------------------------------
// Watch / polling mode
// ---------------------------------------------------------------------------

/**
 * Continuously probe RPC endpoints and print health reports.
 *
 * Runs active health probes in a loop. Pass `deps.sleep`, `deps.write`, and
 * `options.iterations` in tests to make the loop deterministic and fast.
 *
 * @param endpointUrls Array of RPC endpoint URLs
 * @param options Watch options (interval, iterations, probe method/timeout)
 * @param deps Injected dependencies for testing (fake sleep, write, transport)
 */
export async function watchHealth(
  endpointUrls: string[],
  options?: HealthWatchOptions,
  deps?: {
    transports?: Map<string, RpcTransport>;
    sleep?: (ms: number) => Promise<void>;
    write?: (text: string) => void;
    nowMs?: () => number;
  },
): Promise<void> {
  const write = deps?.write ?? ((text: string) => console.log(text));
  const sleep = deps?.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const nowMs = deps?.nowMs ?? (() => Date.now());
  const intervalMs = options?.intervalMs ?? 2000;
  const maxIterations = options?.iterations; // undefined = infinite

  if (!endpointUrls || endpointUrls.length === 0) {
    write(
      `Usage: solana-reliability-sdk health [--watch] [--interval-ms <ms>] <endpoint1> [endpoint2] ...`,
    );
    return;
  }

  let iteration = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const timestamp = new Date(nowMs()).toISOString();
    const report = await createActiveHealthReport(
      endpointUrls,
      options,
      deps?.transports ? { transports: deps.transports } : undefined,
    );
    write(`Updated: ${timestamp}\n${report}`);

    iteration++;
    if (maxIterations !== undefined && iteration >= maxIterations) {
      break;
    }

    await sleep(intervalMs);
  }
}
