/**
 * Simulation command.
 *
 * Runs reliability tests with fake network behavior (drops, latency, failures).
 */

import { createSolanaReliabilitySdk } from "../sdk/create-sdk.js";
import { isOk } from "../core/result.js";
import { createFakeRpcTransport } from "../testing/fake-transport.js";
import { createSdkError } from "../core/error.js";

/**
 * Run reliability simulation.
 *
 * Creates an SDK with fake transports where the first endpoint fails with a retryable error
 * and the second endpoint succeeds. This demonstrates RPC fallback resilience.
 *
 * @returns Simulation results as formatted text string
 */
export async function runSimulation(): Promise<string> {
  const lines: string[] = [];

  lines.push("=== Solana Reliability SDK Simulation ===\n");

  const primaryUrl = "https://primary.rpc.test";
  const backupUrl = "https://backup.rpc.test";
  const primaryId = "https_primary_rpc_test";
  const backupId = "https_backup_rpc_test";

  // Create fake transports
  const primaryTransport = createFakeRpcTransport({
    endpointUrl: primaryUrl,
    endpointId: primaryId,
    responses: new Map([
      [
        "sendTransaction",
        {
          error: createSdkError(
            "NetworkError",
            "simulated primary RPC failure",
            { retryable: true },
          ),
        },
      ],
    ]),
  });

  const backupTransport = createFakeRpcTransport({
    endpointUrl: backupUrl,
    endpointId: backupId,
    responses: new Map([
      ["sendTransaction", { success: "simulation-fallback-signature" }],
    ]),
  });

  // Create SDK with two endpoints (they'll both use fake transports)
  const sdkResult = createSolanaReliabilitySdk(
    {
      endpoints: [primaryUrl, backupUrl],
      retry: {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterRatio: 0,
      },
    },
    {
      transports: new Map([
        [primaryId, primaryTransport],
        [backupId, backupTransport],
      ]),
    },
  );

  if (!isOk(sdkResult)) {
    return `Simulation failed: ${sdkResult.error.message}`;
  }

  const sdk = sdkResult.value;

  lines.push("Step 1: Created SDK with 2 fake endpoints");
  lines.push(`  - Endpoint 1: ${primaryUrl}`);
  lines.push(`  - Endpoint 2: ${backupUrl}\n`);

  // Send a fake transaction (will use fake transports)
  const fakeBase64 = Buffer.from("fake-tx").toString("base64");
  const blockhash = "test-blockhash-123";
  const lastValidBlockHeight = 12345;

  lines.push("Step 2: Sending fake transaction via SDK...");
  const sendResult = await sdk.sendTransaction(fakeBase64, blockhash, lastValidBlockHeight);

  if (!isOk(sendResult)) {
    lines.push(`  Result: NetworkError (expected - using fake transports)`);
    lines.push(`  Error: ${sendResult.error.message}\n`);
  } else {
    lines.push(`  Result: Success`);
    lines.push(`  Signature: ${sendResult.value}\n`);
  }

  // Get endpoint health
  const health = sdk.getEndpointHealth();
  lines.push("Step 3: Endpoint Health Status");
  for (const endpoint of health) {
    lines.push(`  - ${endpoint.id}:`);
    lines.push(`      Success: ${endpoint.successCount}, Failures: ${endpoint.failureCount}`);
    lines.push(`      Avg Latency: ${endpoint.avgLatencyMs.toFixed(1)}ms`);
    lines.push(`      Circuit: ${endpoint.circuitOpen ? "OPEN" : "CLOSED"}`);
  }
  lines.push("");

  // Get metrics
  const metrics = sdk.getMetrics();
  lines.push(`Step 4: Metrics Recorded: ${metrics.length} event(s)`);
  for (const metric of metrics) {
    lines.push(`  - ${metric.type} at ${new Date(metric.timestampMs).toISOString()}`);
  }
  lines.push("");

  lines.push("=== Simulation Complete ===");
  lines.push("Note: This simulation uses fake transports (no real network calls).");
  lines.push("In a real deployment, the SDK would:");
  lines.push("  1. Try first endpoint");
  lines.push("  2. If retryable error, fallback to second endpoint");
  lines.push("  3. Report success/failure and update health metrics");

  return lines.join("\n");
}
