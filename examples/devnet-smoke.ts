/**
 * Devnet smoke-test example.
 *
 * Tests the SDK against real Solana devnet endpoints:
 * - Loads or generates a keypair
 * - Requests airdrop (optional, skipped for funded keypairs)
 * - Confirms airdrop transaction
 * - Checks balance
 * - Reports endpoint health
 *
 * Supports environment variables:
 * - SOLANA_DEVNET_RPC_URL: Custom RPC endpoint (default: https://api.devnet.solana.com)
 * - SOLANA_DEVNET_KEYPAIR: Path to funded Solana CLI keypair JSON file
 *
 * Usage:
 * - Public faucet path (may be rate-limited):
 *   npm run example:devnet
 *
 * - With funded keypair (reliable):
 *   SOLANA_DEVNET_KEYPAIR="$HOME/.config/solana/id.json" npm run example:devnet
 *
 * - Custom RPC endpoint:
 *   SOLANA_DEVNET_RPC_URL="https://your-devnet-rpc.example.com" npm run example:devnet
 *
 * Note:
 * - Public devnet faucet often returns HTTP 429 (rate-limited). This is expected.
 * - For reliable smoke tests, use a funded keypair via SOLANA_DEVNET_KEYPAIR.
 * - Never commit keypair files or API keys to source control.
 *
 * Run: npm run example:devnet
 */

import { createSolanaReliabilitySdk, isOk } from "../src/index.js";
import {
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
} from "@solana/kit";
import { readFile } from "fs/promises";

/**
 * Get a sanitized display string for a URL (hides API keys and secrets)
 */
function getSanitizedUrlDisplay(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    // If it's not a valid URL, just return a generic message
    return "custom endpoint from SOLANA_DEVNET_RPC_URL";
  }
}

/**
 * Load a keypair from a Solana CLI keypair JSON file
 */
async function loadKeypairFromFile(filePath: string) {
  const normalizedPath = filePath.startsWith("~")
    ? filePath.replace("~", process.env.HOME || "")
    : filePath;

  try {
    const fileContent = await readFile(normalizedPath, "utf-8");
    const keypairArray: number[] = JSON.parse(fileContent);

    if (!Array.isArray(keypairArray) || keypairArray.length !== 64) {
      throw new Error(
        `Invalid keypair file format. Expected 64-byte array, got ${keypairArray.length} bytes.`
      );
    }

    const keypairBytes = new Uint8Array(keypairArray);
    const signer = await createKeyPairSignerFromBytes(keypairBytes);
    return signer;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Keypair file not found: ${normalizedPath}`);
    }
    throw error;
  }
}

/**
 * Determine if we should skip airdrop (true if keypair is funded, false if generated)
 */
function shouldSkipAirdrop(isFundedKeypair: boolean): boolean {
  return isFundedKeypair;
}

/**
 * Unwrap lamports value from various response formats
 */
function unwrapLamportsValue(input: unknown): bigint {
  // Handle raw bigint
  if (typeof input === "bigint") {
    return input;
  }

  // Handle raw number
  if (typeof input === "number") {
    return BigInt(input);
  }

  // Handle string numeric value
  if (typeof input === "string") {
    return BigInt(input);
  }

  // Handle { value: ... } wrapped format (Solana RPC standard)
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    if ("value" in obj) {
      return unwrapLamportsValue(obj.value);
    }
  }

  throw new Error(
    `Unable to extract lamports value from response: ${String(input)}`
  );
}

async function main() {
  try {
    console.log("=== Solana Devnet Smoke Test ===\n");

    // Step 1: Create SDK with devnet endpoints
    console.log("Step 1: Creating SDK with devnet endpoints...");

    // Use public devnet endpoint by default, allow override via env var
    const devnetRpcUrl =
      process.env.SOLANA_DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
    const sanitizedUrl = getSanitizedUrlDisplay(devnetRpcUrl);
    console.log(`  Using endpoint: ${sanitizedUrl}`);

    const sdkResult = createSolanaReliabilitySdk({
      endpoints: [devnetRpcUrl],
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

    // Step 2: Load or generate keypair
    console.log("Step 2: Loading or generating keypair...");

    let signer;
    let isFundedKeypair = false;

    if (process.env.SOLANA_DEVNET_KEYPAIR) {
      try {
        signer = await loadKeypairFromFile(process.env.SOLANA_DEVNET_KEYPAIR);
        isFundedKeypair = true;
        console.log(`✓ Keypair loaded from SOLANA_DEVNET_KEYPAIR`);
      } catch (error) {
        console.error(
          `✗ Failed to load keypair from SOLANA_DEVNET_KEYPAIR: ${String(error)}`
        );
        process.exit(1);
      }
    } else {
      // Generate a temporary keypair for public faucet test
      signer = await generateKeyPairSigner();
      isFundedKeypair = false;
      console.log(`✓ Temporary keypair generated`);
    }

    const publicKeyString = String(signer.address);
    console.log(`  Public Key: ${publicKeyString.substring(0, 20)}...\n`);

    // Step 3: Request airdrop (skip if using funded keypair)
    console.log("Step 3: Requesting airdrop (0.1 SOL)...");
    let airdropSignature: string | undefined;
    let airdropSkipped = false;

    if (shouldSkipAirdrop(isFundedKeypair)) {
      console.log(`✓ Skipped airdrop (using funded keypair)\n`);
      airdropSkipped = true;
    } else {
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
        const errorStr = String(error);
        console.error(`✗ Airdrop failed: ${errorStr}`);

        // Handle 429 rate limit gracefully with helpful guidance
        if (
          errorStr.includes("rate limit") ||
          errorStr.includes("faucet") ||
          errorStr.includes("429")
        ) {
          console.error(
            "\nDevnet faucet is rate-limited. Set SOLANA_DEVNET_KEYPAIR to a funded devnet keypair JSON file, or use SOLANA_DEVNET_RPC_URL with a provider that supports devnet airdrops.\n"
          );
          // Exit gracefully with helpful message (not an unhandled error)
          process.exit(0);
        }

        // For other errors (401, etc), provide auth-specific guidance
        if (errorStr.includes("401") || errorStr.includes("Unauthorized")) {
          console.error(
            "RPC endpoint rejected the request. Set SOLANA_DEVNET_RPC_URL to a valid devnet RPC endpoint or use https://api.devnet.solana.com."
          );
        }

        // Exit on other airdrop errors
        process.exit(1);
      }
    }

    // Step 4: Confirm airdrop (skip if airdrop was skipped)
    if (!airdropSkipped && airdropSignature) {
      console.log("Step 4: Confirming airdrop transaction...");
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
        { value: number }
      >("getBalance", [publicKeyString]);

      const balanceLamports = unwrapLamportsValue(balanceResult);
      const balanceSol = Number(balanceLamports) / 1_000_000_000;
      console.log(`✓ Balance retrieved`);
      console.log(`  Lamports: ${balanceLamports}`);
      console.log(`  SOL: ${balanceSol.toFixed(9)}\n`);
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
