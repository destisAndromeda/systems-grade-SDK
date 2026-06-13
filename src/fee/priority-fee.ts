/**
 * Priority fee utilities.
 *
 * Functions to create fee providers, check staleness,
 * and get priority fee estimates.
 */

import type { PriorityFeeEstimate, PriorityFeeProvider, PriorityFeeConfig } from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Clock } from "../core/clock.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";
import { ok, err } from "../core/result.js";
import { createSdkError, isKindOfSdkError, mapToSdkError } from "../core/error.js";

/**
 * Create a static priority fee provider.
 *
 * Returns a fixed fee estimate regardless of network conditions.
 *
 * @param microLamports Fee estimate value
 * @param clock Clock for timestamping
 * @returns Fee provider
 */
export function createStaticPriorityFeeProvider(
  microLamports: number,
  clock: Clock,
): PriorityFeeProvider {
  return {
    name: "static",
    async getEstimate(nowMs: number): Promise<Result<PriorityFeeEstimate, SdkError>> {
      // Validate fee amount
      if (microLamports < 0) {
        return err(createSdkError("InvalidConfig", "Priority fee cannot be negative"));
      }
      if (!Number.isFinite(microLamports)) {
        return err(createSdkError("InvalidConfig", "Priority fee must be finite"));
      }

      return ok({
        priorityFeeMicroLamports: microLamports,
        source: "static",
        fetchedAtMs: clock.now(),
      });
    },
  };
}

/**
 * Create a priority fee provider from RPC.
 *
 * Queries the RPC endpoint for current fee estimates.
 *
 * @param transport RPC transport
 * @param clock Clock for timestamping
 * @returns Fee provider
 */
export function createRpcPriorityFeeProvider(
  transport: RpcTransport,
  clock: Clock,
): PriorityFeeProvider {
  return {
    name: "rpc",
    async getEstimate(nowMs: number): Promise<Result<PriorityFeeEstimate, SdkError>> {
      try {
        const response = await transport.send<[], unknown>(
          "getRecentPrioritizationFees",
          [],
        );

        // Extract prioritization fees from various response formats
        let fees: number[] = [];

        // Handle direct array response: [{ prioritizationFee: 100 }, ...]
        if (Array.isArray(response)) {
          fees = extractFeesFromArray(response);
        }
        // Handle wrapped response: { result: [...] }
        else if (
          response &&
          typeof response === "object" &&
          "result" in response &&
          Array.isArray((response as any).result)
        ) {
          fees = extractFeesFromArray((response as any).result);
        }
        // Handle wrapped response: { value: [...] }
        else if (
          response &&
          typeof response === "object" &&
          "value" in response &&
          Array.isArray((response as any).value)
        ) {
          fees = extractFeesFromArray((response as any).value);
        } else {
          return err(
            createSdkError(
              "InvalidResponse",
              "Priority fee response was not array or wrapped array",
            ),
          );
        }

        // No valid fees found
        if (fees.length === 0) {
          return err(
            createSdkError("InvalidResponse", "No valid prioritization fees in response"),
          );
        }

        // Use max fee strategy
        const maxFee = Math.max(...fees);

        return ok({
          priorityFeeMicroLamports: maxFee,
          source: "rpc",
          fetchedAtMs: clock.now(),
        });
      } catch (error) {
        // If already an SdkError, return as-is
        if (isKindOfSdkError(error)) {
          return err(error);
        }
        // Map unknown error to SdkError
        const sdkError = mapToSdkError(error, "NetworkError");
        return err(sdkError);
      }
    },
  };
}

/**
 * Extract valid prioritization fees from an array of fee objects.
 *
 * @param items Array of items to extract fees from
 * @returns Array of valid numeric fees
 */
function extractFeesFromArray(items: unknown[]): number[] {
  const fees: number[] = [];

  for (const item of items) {
    if (
      item &&
      typeof item === "object" &&
      "prioritizationFee" in item
    ) {
      const fee = (item as any).prioritizationFee;
      if (typeof fee === "number" && Number.isFinite(fee) && fee >= 0) {
        fees.push(fee);
      }
    }
  }

  return fees;
}

/**
 * Check if a fee estimate is stale.
 *
 * @param estimate Fee estimate
 * @param nowMs Current time
 * @param maxStaleMs Max age before considered stale
 * @returns true if estimate is too old
 */
export function isPriorityFeeStale(
  estimate: PriorityFeeEstimate,
  nowMs: number,
  maxStaleMs: number,
): boolean {
  const elapsedMs = nowMs - estimate.fetchedAtMs;
  return elapsedMs > maxStaleMs;
}

/**
 * Get priority fee estimate from a list of providers.
 *
 * Returns the first non-stale estimate, or fallback if all fail/are stale.
 *
 * @param providers Fee providers to query
 * @param config Fee configuration
 * @param clock Clock for staleness checking
 * @returns Fee estimate or error
 */
export async function getPriorityFeeEstimate(
  providers: PriorityFeeProvider[],
  config: PriorityFeeConfig,
  clock: Clock,
): Promise<Result<PriorityFeeEstimate, SdkError>> {
  // Validate config
  if (config.fallbackMicroLamports < 0) {
    return err(createSdkError("InvalidConfig", "Fallback fee cannot be negative"));
  }
  if (!Number.isFinite(config.fallbackMicroLamports)) {
    return err(createSdkError("InvalidConfig", "Fallback fee must be finite"));
  }
  if (config.maxStaleMs < 0) {
    return err(createSdkError("InvalidConfig", "maxStaleMs cannot be negative"));
  }

  const nowMs = clock.now();

  // Try each provider in order
  for (const provider of providers) {
    try {
      const result = await provider.getEstimate(nowMs);

      if (result.ok) {
        const estimate = result.value;

        // Check if estimate is stale
        if (!isPriorityFeeStale(estimate, nowMs, config.maxStaleMs)) {
          return ok(estimate);
        }
        // Estimate is stale, try next provider
        continue;
      }

      // Provider returned error, try next provider
      continue;
    } catch (error) {
      // Provider threw unexpectedly, try next provider
      continue;
    }
  }

  // All providers failed or returned stale estimates, return fallback
  return ok({
    priorityFeeMicroLamports: config.fallbackMicroLamports,
    source: "fallback",
    fetchedAtMs: nowMs,
  });
}
