/**
 * Health check command.
 *
 * Checks the status of RPC endpoints and reports their health.
 */

import type { SolanaReliabilitySdk } from "../sdk/types.js";
import { createSolanaReliabilitySdk } from "../sdk/create-sdk.js";
import { isOk } from "../core/result.js";

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

/**
 * Create a health report for given endpoints.
 *
 * Creates an SDK instance with the provided endpoints and reports their health status.
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
