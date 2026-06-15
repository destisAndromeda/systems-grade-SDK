/**
 * Jito relay client adapter.
 *
 * Creates a RelayClient that sends transactions to Jito via RPC transport.
 */

import type { RelayClient, RelaySendResult } from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import { mapTransportErrorToSdkError } from "../rpc/transport.js";

/**
 * Create a Jito relay client.
 *
 * @param transport RPC transport to use for Jito endpoint
 * @param options Configuration options
 * @returns Jito relay client
 */
export function createJitoRelayClient(
  transport: RpcTransport,
  options?: {
    name?: string;
    method?: "sendTransaction" | "sendBundle";
  },
): RelayClient {
  const name = options?.name ?? "jito";
  const method = options?.method ?? "sendTransaction";

  const client: RelayClient = {
    name,

    async sendTransaction(base64: string): Promise<RelaySendResult> {
      try {
        let response: unknown;

        if (method === "sendBundle") {
          response = await transport.send<[string[]], string | { result?: string; signature?: string }>(
            "sendBundle",
            [[base64]],
          );
        } else {
          // sendTransaction
          response = await transport.send<
            [string, { encoding: string; skipPreflight: boolean }],
            string | { result?: string; signature?: string }
          >("sendTransaction", [base64, { encoding: "base64", skipPreflight: true }]);
        }

        // Parse signature from various response shapes
        let signature: string | undefined;

        if (typeof response === "string") {
          signature = response;
        } else if (response && typeof response === "object") {
          const obj = response as Record<string, unknown>;
          if ("result" in obj && typeof obj.result === "string") {
            signature = obj.result;
          } else if ("signature" in obj && typeof obj.signature === "string") {
            signature = obj.signature;
          }
        }

        // Validate signature
        if (!signature || signature.trim().length === 0) {
          throw createSdkError("InvalidResponse", "Jito relay response missing or empty signature");
        }

        return {
          signature,
          relayName: name,
        };
      } catch (error: unknown) {
        if (isKindOfSdkError(error)) {
          throw error;
        }
        throw mapTransportErrorToSdkError(error);
      }
    },
  };


  return client;
}

// ─── Jito dynamic tip floor ─────────────────────────────────────────────────

/**
 * Jito tip-floor percentile data (in lamports).
 */
export interface JitoTipFloor {
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

/**
 * Aggressiveness level for Jito tip selection.
 *   low    → p25
 *   medium → p50
 *   high   → p75
 */
export type JitoTipAggressiveness = "low" | "medium" | "high";

/** Fallback values (lamports) used when the live endpoint is unavailable. */
const FALLBACK_JITO_TIP_FLOOR: JitoTipFloor = {
  p25: 1_000,
  p50: 2_000,
  p75: 5_000,
  p95: 10_000,
};

const JITO_TIP_FLOOR_URL = "https://bundles.jito.wtf/api/v1/bundles/tip_floor";
const CACHE_TTL_MS = 60_000;

interface TipFloorCache {
  value: JitoTipFloor;
  fetchedAtMs: number;
}

/** Module-level cache – reset-able for tests. */
let _jitoTipFloorCache: TipFloorCache | undefined;

/**
 * Reset the module-level tip-floor cache.
 * Only call this from tests to ensure isolation between test cases.
 */
export function resetJitoTipFloorCacheForTests(): void {
  _jitoTipFloorCache = undefined;
}

/** Parse raw API response into a JitoTipFloor. Tolerates array and object shapes. */
function parseTipFloor(raw: unknown): JitoTipFloor | undefined {
  let obj: unknown = raw;

  // API returns [{ percentile_25, … }] — unwrap array
  if (Array.isArray(raw) && raw.length > 0) {
    obj = raw[0];
  }

  if (!obj || typeof obj !== "object") return undefined;

  const rec = obj as Record<string, unknown>;

  const p25 =
    typeof rec["percentile_25"] === "number"
      ? rec["percentile_25"]
      : typeof rec["p25"] === "number"
        ? rec["p25"]
        : undefined;

  const p50 =
    typeof rec["percentile_50"] === "number"
      ? rec["percentile_50"]
      : typeof rec["p50"] === "number"
        ? rec["p50"]
        : undefined;

  const p75 =
    typeof rec["percentile_75"] === "number"
      ? rec["percentile_75"]
      : typeof rec["p75"] === "number"
        ? rec["p75"]
        : undefined;

  const p95 =
    typeof rec["percentile_95"] === "number"
      ? rec["percentile_95"]
      : typeof rec["p95"] === "number"
        ? rec["p95"]
        : undefined;

  if (
    p25 === undefined ||
    p50 === undefined ||
    p75 === undefined ||
    p95 === undefined
  ) {
    return undefined;
  }

  return { p25, p50, p75, p95 };
}

/**
 * Fetch the current Jito tip floor from the Jito bundles API.
 *
 * - Results are cached for 60 seconds.
 * - Falls back to safe static constants on any error (never throws).
 *
 * @param fetch_ Injected fetch (defaults to global fetch). Pass a fake in tests.
 * @param nowMs  Injected clock (defaults to Date.now). Overridable for
 *               deterministic cache-expiry testing.
 */
export async function getJitoTipFloor(
  fetch_: typeof fetch = fetch,
  nowMs: () => number = Date.now,
): Promise<JitoTipFloor> {
  const now = nowMs();

  // Return cached value if still fresh
  if (
    _jitoTipFloorCache !== undefined &&
    now - _jitoTipFloorCache.fetchedAtMs < CACHE_TTL_MS
  ) {
    return _jitoTipFloorCache.value;
  }

  try {
    const response = await fetch_(JITO_TIP_FLOOR_URL);

    if (!response.ok) {
      return FALLBACK_JITO_TIP_FLOOR;
    }

    const raw: unknown = await response.json();
    const parsed = parseTipFloor(raw);

    if (!parsed) {
      return FALLBACK_JITO_TIP_FLOOR;
    }

    _jitoTipFloorCache = { value: parsed, fetchedAtMs: now };
    return parsed;
  } catch {
    return FALLBACK_JITO_TIP_FLOOR;
  }
}

/**
 * Select a tip amount in lamports from a JitoTipFloor using an aggressiveness level.
 *
 *   low    → p25
 *   medium → p50
 *   high   → p75
 *
 * @param floor           Tip-floor percentile data
 * @param aggressiveness  Target aggressiveness level
 * @returns Tip in lamports
 */
export function selectJitoTipLamports(
  floor: JitoTipFloor,
  aggressiveness: JitoTipAggressiveness,
): number {
  switch (aggressiveness) {
    case "low":
      return floor.p25;
    case "medium":
      return floor.p50;
    case "high":
      return floor.p75;
  }
}
