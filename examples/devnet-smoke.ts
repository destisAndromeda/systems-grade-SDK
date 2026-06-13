/**
 * Devnet smoke-test example.
 *
 * Tests the SDK against real Solana devnet endpoints:
 * - Generates a keypair
 * - Requests airdrop
 * - Confirms airdrop transaction
 * - Checks balance
 * - Reports endpoint health
 *
 * Run: npm run example:devnet
 */

import { createSolanaReliabilitySdk, isOk } from "../src/index.js";
import { generateKeyPairSigner } from "@solana/kit";

async function main() {
  try {
    console.log("=== Solana Devnet Smoke Test ===\n");

    // Step 1: Create SDK with devnet endpoints
    console.log("Step 1: Creating SDK with devnet endpoints...");
    const sdkResult = createSolanaReliabilitySdk({
      endpoints: [
        "https://api.devnet.solana.com",
        "https://devnet.helius-rpc.com/?api-key=demo",
      ],
      retry: {
        maxAttempts: 3,
      },
      circuitBreaker: {
        failureThreshold: 3,
      },
    });

    if (!isOk(sdkResult)) {
      console.error("✗ Failed to create SDK:", sdkResult.error.message);
      process.exit(1);
    }

    const sdk = sdkResult.value;
    console.log("✓ SDK created successfully\n");

    // Step 2: Generate a fresh keypair
    console.log("Step 2: Generating keypair...");
    const signer = await generateKeyPairSigner();
    
    // Convert signer to public key string (base58 address)
    // @solana/kit signers stringify to their public key
    const publicKeyString = `${signer}`;
    console.log(`✓ Keypair generated`);
    console.log(`  Public Key: ${publicKeyString.substring(0, 20)}...\n`);

    // Step 3: Request airdrop
    console.log("Step 3: Requesting airdrop (0.1 SOL)...");
    let airdropSignature: string | undefined;

    try {
      // Request airdrop: 100_000_000 lamports = 0.1 SOL
      // The RPC method expects a public key as a string in base58 format
      const airdropResult = await sdk.rpc.send<
        [string, number],
        string
      >("requestAirdrop", [publicKeyString, 100_000_000]);

      airdropSignature = airdropResult;
      console.log(`✓ Airdrop requested`);
      console.log(`  Signature: ${airdropSignature}\n`);
    } catch (error) {
      console.error(`✗ Airdrop failed: ${String(error)}`);
      process.exit(1);
    }

    // Step 4: Confirm airdrop
    console.log("Step 4: Confirming airdrop transaction...");
    if (airdropSignature) {
      try {
        const confirmResult = await sdk.confirmTransaction(airdropSignature);

        if (isOk(confirmResult)) {
          console.log(`✓ Airdrop confirmed`);
          console.log(`  Slot: ${confirmResult.value.slot}`);
          console.log(`  Confirmed: ${confirmResult.value.confirmed}\n`);
        } else {
          console.error(`✗ Confirmation failed: ${confirmResult.error.message}`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`✗ Confirmation error: ${String(error)}`);
        process.exit(1);
      }
    }

    // Step 5: Check balance
    console.log("Step 5: Checking balance...");
    try {
      const balanceResult = await sdk.rpc.send<
        [string],
        number
      >("getBalance", [publicKeyString]);

      const balanceLamports = balanceResult;
      const balanceSol = balanceLamports / 1_000_000_000;
      console.log(`✓ Balance retrieved`);
      console.log(`  Lamports: ${balanceLamports}`);
      console.log(`  SOL: ${balanceSol.toFixed(4)}\n`);
    } catch (error) {
      console.error(`✗ Balance error: ${String(error)}`);
      process.exit(1);
    }

    // Step 6: Print endpoint health
    console.log("Step 6: Endpoint health report:");
    const health = sdk.getEndpointHealth();
    for (const endpoint of health) {
      console.log(`  ${endpoint.id}:`);
      console.log(`    URL: ${endpoint.url}`);
      console.log(`    Successes: ${endpoint.successCount}`);
      console.log(`    Failures: ${endpoint.failureCount}`);
      console.log(`    Avg Latency: ${endpoint.avgLatencyMs.toFixed(0)}ms`);
      console.log(`    Circuit: ${endpoint.circuitOpen ? "OPEN" : "CLOSED"}`);
    }
    console.log("");

    // Success summary
    console.log("✓ devnet smoke-test passed");
  } catch (error) {
    console.error("✗ Unexpected error:", error);
    process.exit(1);
  }
}

main();
