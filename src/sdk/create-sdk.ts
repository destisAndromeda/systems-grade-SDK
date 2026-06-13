/**
 * SDK factory and initialization.
 *
 * Functions to validate config and create the main SDK facade.
 */

import type { SolanaReliabilitySdkConfig, SolanaReliabilitySdk } from "./types";
import type { Result } from "../core/result";
import { ok, err } from "../core/result";
import { createSdkError } from "../core/error";

/**
 * Validate SDK configuration.
 *
 * Checks that required fields are present and valid.
 *
 * @param config SDK configuration
 * @returns Validation result
 */
export function validateSdkConfig(config: SolanaReliabilitySdkConfig): Result<void> {
  // TODO: validate endpoints array, retry/circuit settings, etc.
  // return ok() if valid, err(InvalidConfig) otherwise
  throw new Error("TODO");
}

/**
 * Create a Solana Reliability SDK instance.
 *
 * Initializes the registry, transports, resilience policies,
 * and exposes the high-level SDK facade.
 *
 * @param config SDK configuration
 * @returns SDK instance or error if config invalid
 */
export async function createSolanaReliabilitySdk(
  config: SolanaReliabilitySdkConfig,
): Promise<Result<SolanaReliabilitySdk>> {
  // TODO: validate config, initialize components, return SDK facade or error
  throw new Error("TODO");
}

/**
 * SDK implementation.
 */
class SolanaReliabilitySdkImpl implements SolanaReliabilitySdk {
  async sendTransaction(
    transactionBase64: string,
    blockhash: string,
    lastValidBlockHeight: number,
  ): Promise<string> {
    // TODO: build transaction, send via relay or RPC, return signature
    throw new Error("TODO");
  }

  async confirmTransaction(
    signature: string,
  ): Promise<{ confirmed: boolean; slot?: number }> {
    // TODO: poll for confirmation, return status
    throw new Error("TODO");
  }

  async getPriorityFee(): Promise<number> {
    // TODO: get estimate from providers or return default
    throw new Error("TODO");
  }

  async getEndpointHealth(): Promise<{
    endpoints: Array<{
      url: string;
      healthy: boolean;
      successRate: number;
      avgLatencyMs: number;
    }>;
  }> {
    // TODO: return health info from registry
    throw new Error("TODO");
  }
}
