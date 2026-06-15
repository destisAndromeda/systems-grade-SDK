/**
 * Health check command.
 *
 * Checks the status of RPC endpoints and reports their health.
 * Supports one-shot and watch/polling modes with injectable deps for testing.
 */

import type { RpcTransport } from "../rpc/types.js";
import { createSolanaReliabilitySdk } from "../sdk/create-sdk.js";
import { isOk } from "../core/result.js";
import { createHttpRpcTransport } from "../rpc/http-transport.js";

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

export interface HealthOptions {
  iterations?: number;
}

export interface WatchHealthOptions {
  intervalMs?: number;
  iterations?: number; // Added to support test iteration limits without infinite loops
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
// createHealthReport (async version required by Phase 9)
// ---------------------------------------------------------------------------

/**
 * Create a health report for given endpoints.
 *
 * @param endpoints Array of RPC endpoint URLs
 * @param options Health report options
 * @param deps Injectable dependencies for testing
 * @returns Health report as formatted text string
 */
export async function createHealthReport(
  endpoints: string[],
  options?: HealthOptions,
  deps?: {
    transports?: Map<string, RpcTransport>;
  },
): Promise<string> {
  if (!endpoints || endpoints.length === 0) {
    return `Usage: solana-reliability-sdk health <endpoint1> [endpoint2] ...\n\nExample:\n  solana-reliability-sdk health https://api.mainnet-beta.solana.com https://backup.rpc.solana.com`;
  }

  const lines: string[] = ["RPC Health Report"];

  for (const endpoint of endpoints) {
    const id = endpoint.replace(/[^a-zA-Z0-9]/g, "_");
    let transport: RpcTransport;
    if (deps?.transports && deps.transports.has(id)) {
      transport = deps.transports.get(id)!;
    } else if (deps?.transports && deps.transports.has(endpoint)) {
      transport = deps.transports.get(endpoint)!;
    } else {
      transport = createHttpRpcTransport({
        endpointUrl: endpoint,
        endpointId: id,
      });
    }

    let status = "ok";
    try {
      await transport.send("getHealth", []);
    } catch (error: unknown) {
      status = "error";
    }
    lines.push(`- ${endpoint}: ${status}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Active one-shot probe (retained for backward compatibility/index exports)
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
 * @param endpoints Array of RPC endpoint URLs
 * @param options Watch options (interval, iterations)
 * @param deps Injected dependencies for testing (fake sleep, write, transport)
 */
export async function watchHealth(
  endpoints: string[],
  options?: WatchHealthOptions,
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
  const intervalMs = options?.intervalMs ?? 5000;
  const maxIterations = options?.iterations; // undefined = infinite

  if (!endpoints || endpoints.length === 0) {
    write(`Usage: solana-sdk health <endpoints...>`);
    return;
  }

  let iteration = 0;
  while (true) {
    const timestamp = new Date(nowMs()).toISOString();
    const report = await createHealthReport(
      endpoints,
      {},
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
