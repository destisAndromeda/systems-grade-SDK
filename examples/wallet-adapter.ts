/**
 * Wallet adapter example.
 *
 * Demonstrates:
 * - Creating a minimal fake wallet
 * - Configuring the SDK with wallet adapter
 * - Signing and sending transactions via wallet
 */

import {
  createSolanaReliabilitySdk,
  isOk,
  type TransactionWallet,
} from "../src/index.js";

// Create a minimal fake wallet for demonstration
const createFakeWallet = (): TransactionWallet => {
  return {
    signTransaction: async (base64: string) => {
      // Simulate wallet signing: append "-signed" to the transaction
      const signedBase64 = base64 + "-signed";
      const publicKey = Buffer.from("fake-pubkey-123").toString("base64");
      return { signedBase64, publicKey };
    },
  };
};

async function main() {
  console.log("=== Wallet Adapter Example ===\n");

  // Step 1: Create a fake wallet
  console.log("Step 1: Creating a fake wallet...");
  const wallet = createFakeWallet();
  console.log("✓ Wallet created\n");

  // Step 2: Create SDK with wallet adapter
  console.log("Step 2: Creating SDK with wallet...");
  const sdkResult = createSolanaReliabilitySdk({
    endpoints: [
      "https://api.mainnet-beta.solana.com",
      "https://backup.rpc.solana.com",
    ],
    wallet,
  });

  if (!isOk(sdkResult)) {
    console.error("Failed to create SDK:", sdkResult.error.message);
    process.exit(1);
  }

  const sdk = sdkResult.value;
  console.log("✓ SDK configured with wallet\n");

  // Step 3: Send a transaction (will be signed by wallet)
  console.log("Step 3: Sending transaction (will be signed by wallet)...");
  const fakeBase64 = Buffer.from("fake-tx-to-sign").toString("base64");
  const blockhash = "test-blockhash-wallet";
  const lastValidBlockHeight = 12345;

  const sendResult = await sdk.sendTransaction(
    fakeBase64,
    blockhash,
    lastValidBlockHeight,
  );

  if (isOk(sendResult)) {
    console.log(`✓ Transaction signed and sent!`);
    console.log(`  Signature: ${sendResult.value}\n`);
  } else {
    console.log(`Transaction error: ${sendResult.error.message}`);
    console.log("Note: This is expected with fake transports\n");
  }

  // Step 4: Confirm the transaction
  console.log("Step 4: Confirming transaction...");
  if (isOk(sendResult)) {
    const confirmResult = await sdk.confirmTransaction(sendResult.value);
    if (isOk(confirmResult)) {
      console.log(`✓ Confirmation status: ${confirmResult.value.confirmed}\n`);
    } else {
      console.log(`Confirmation error: ${confirmResult.error.message}\n`);
    }
  }

  // Step 5: Show endpoint health
  console.log("Step 5: Endpoint health after transaction:");
  const health = sdk.getEndpointHealth();
  for (const endpoint of health) {
    console.log(`  - ${endpoint.id}: Success=${endpoint.successCount}, Failures=${endpoint.failureCount}`);
  }

  console.log("\n=== Wallet Adapter Example Complete ===");
  console.log("In production, this SDK would:");
  console.log("1. Build the transaction");
  console.log("2. Request wallet signature (via signTransaction)");
  console.log("3. Send the signed transaction via RPC");
  console.log("4. Poll for confirmation");
  console.log("5. Report success/failure to your application");
}

main().catch(console.error);
