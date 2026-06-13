/**
 * Basic SDK usage example.
 *
 * Demonstrates:
 * - Creating an SDK instance with fake endpoints
 * - Sending a transaction
 * - Confirming a transaction
 * - Getting priority fee estimates
 * - Checking endpoint health
 * - Viewing recorded metrics
 */

import {
  createSolanaReliabilitySdk,
  isOk,
} from "../src/index.js";

async function main() {
  console.log("=== Basic Solana Reliability SDK Example ===\n");

  // Step 1: Create SDK with fake endpoints
  console.log("Step 1: Creating SDK with two RPC endpoints...");
  const sdkResult = createSolanaReliabilitySdk({
    endpoints: [
      "https://api.mainnet-beta.solana.com",
      "https://backup.rpc.solana.com",
    ],
    retry: {
      maxAttempts: 3,
      baseDelayMs: 100,
    },
  });

  if (!isOk(sdkResult)) {
    console.error("Failed to create SDK:", sdkResult.error.message);
    process.exit(1);
  }

  const sdk = sdkResult.value;
  console.log("✓ SDK created successfully\n");

  // Step 2: Get priority fee estimate
  console.log("Step 2: Getting priority fee estimate...");
  const feeResult = await sdk.getPriorityFee();
  if (isOk(feeResult)) {
    console.log(`✓ Priority fee: ${feeResult.value} microlamports\n`);
  } else {
    console.log(`Note: Priority fee estimate not available (${feeResult.error.message})\n`);
  }

  // Step 3: Check endpoint health
  console.log("Step 3: Checking endpoint health...");
  const health = sdk.getEndpointHealth();
  console.log(`✓ Found ${health.length} endpoint(s):`);
  for (const endpoint of health) {
    console.log(`  - ${endpoint.id}: ${endpoint.url}`);
    console.log(`    Success: ${endpoint.successCount}, Failures: ${endpoint.failureCount}`);
    console.log(`    Circuit: ${endpoint.circuitOpen ? "OPEN" : "CLOSED"}`);
  }
  console.log("");

  // Step 4: Send a fake transaction
  console.log("Step 4: Sending a fake transaction...");
  const fakeBase64 = Buffer.from("fake-solana-tx").toString("base64");
  const blockhash = "test-blockhash-123";
  const lastValidBlockHeight = 12345;

  const sendResult = await sdk.sendTransaction(
    fakeBase64,
    blockhash,
    lastValidBlockHeight,
  );

  if (isOk(sendResult)) {
    console.log(`✓ Transaction sent! Signature: ${sendResult.value}\n`);

    // Step 5: Confirm the transaction
    console.log("Step 5: Confirming transaction...");
    const confirmResult = await sdk.confirmTransaction(sendResult.value);

    if (isOk(confirmResult)) {
      const status = confirmResult.value;
      console.log(`✓ Confirmation status:`);
      console.log(`  Confirmed: ${status.confirmed}`);
      if (status.slot !== undefined) {
        console.log(`  Slot: ${status.slot}`);
      }
      console.log("");
    } else {
      console.log(`Transaction confirmation: ${confirmResult.error.message}\n`);
    }
  } else {
    console.log(`Transaction send error: ${sendResult.error.message}\n`);
    console.log("Note: This is expected with fake transports (no real network)\n");
  }

  // Step 6: View recorded metrics
  console.log("Step 6: Viewing recorded metrics...");
  const metrics = sdk.getMetrics();
  console.log(`✓ Recorded ${metrics.length} metric event(s):`);
  for (const metric of metrics) {
    console.log(`  - ${metric.type} at ${new Date(metric.timestampMs).toISOString()}`);
  }

  console.log("\n=== Example Complete ===");
  console.log("The SDK provides:");
  console.log("✓ Resilient RPC calls with automatic retry and fallback");
  console.log("✓ Transaction sending and confirmation with polling");
  console.log("✓ Priority fee estimation");
  console.log("✓ Health monitoring of RPC endpoints");
  console.log("✓ Metrics recording for observability");
}

main().catch(console.error);
