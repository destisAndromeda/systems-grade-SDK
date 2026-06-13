/**
 * Relay fallback example.
 *
 * Demonstrates:
 * - Creating a relay client
 * - Configuring relay fallback routing
 * - Sending a transaction via relay with RPC fallback
 * - Observing the fallback behavior
 */

import {
  createSolanaReliabilitySdk,
  createJitoRelayClient,
  createFakeRpcTransport,
  isOk,
} from "../src/index.js";

async function main() {
  console.log("=== Relay Fallback Example ===\n");

  // Step 1: Create a relay client
  console.log("Step 1: Creating a Jito relay client...");
  const fakeRpcTransport = createFakeRpcTransport({
    endpointUrl: "https://relay.jito.wtf",
    endpointId: "jito-relay",
    responses: new Map([["sendBundle", { success: "relay-sig-123" }]]),
  });

  const relayClient = createJitoRelayClient(fakeRpcTransport, { name: "jito" });
  console.log("✓ Relay client created\n");

  // Step 2: Create SDK with relay routing
  console.log("Step 2: Creating SDK with relay and RPC endpoints...");
  const sdkResult = createSolanaReliabilitySdk({
    endpoints: [
      "https://api.mainnet-beta.solana.com",
      "https://backup.rpc.solana.com",
    ],
    relay: relayClient,
    relayRouting: {
      preferRelay: true,
      fallbackToRpc: true,
    },
  });

  if (!isOk(sdkResult)) {
    console.error("Failed to create SDK:", sdkResult.error.message);
    process.exit(1);
  }

  const sdk = sdkResult.value;
  console.log("✓ SDK configured with relay and fallback\n");

  // Step 3: Send a transaction (will attempt relay first)
  console.log("Step 3: Sending transaction (will try relay first)...");
  const fakeBase64 = Buffer.from("fake-tx-for-relay").toString("base64");
  const blockhash = "test-blockhash-relay";
  const lastValidBlockHeight = 12345;

  const sendResult = await sdk.sendTransaction(
    fakeBase64,
    blockhash,
    lastValidBlockHeight,
  );

  if (isOk(sendResult)) {
    console.log(`✓ Transaction sent successfully!`);
    console.log(`  Signature: ${sendResult.value}\n`);
  } else {
    console.log(`Transaction send error: ${sendResult.error.message}`);
    console.log("In a real scenario with relay failure, would fallback to RPC\n");
  }

  // Step 4: Show endpoint health
  console.log("Step 4: Endpoint health after transaction:");
  const health = sdk.getEndpointHealth();
  for (const endpoint of health) {
    console.log(`  - ${endpoint.id}: Success=${endpoint.successCount}, Failures=${endpoint.failureCount}`);
  }

  console.log("\n=== Relay Fallback Example Complete ===");
  console.log("In production, this SDK would:");
  console.log("1. Attempt to send via Jito relay for MEV protection");
  console.log("2. If relay fails with retryable error, automatically fallback to RPC");
  console.log("3. Update endpoint health metrics for both relay and RPC");
  console.log("4. Report which route was successfully used");
}

main().catch(console.error);
