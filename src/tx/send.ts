/**
 * Transaction sending utilities.
 *
 * Functions to build, validate, simulate, and send Solana transactions
 * via resilient RPC.
 */

import type {
  PreparedTransaction,
  SendTransactionOptions,
  SendTransactionResult,
  TransactionSimulationResult,
  SendWithPreflightGuardOptions,
} from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import type { SdkError } from "../core/error.js";
import { mapTransportErrorToSdkError } from "../rpc/transport.js";

/**
 * Build a prepared transaction from base64 and blockhash.
 *
 * Validates that base64 and blockhash are present and valid.
 *
 * @param base64 Serialized transaction in base64
 * @param blockhash Recent blockhash
 * @param lastValidBlockHeight Block height after which blockhash expires
 * @returns Prepared transaction or error
 */
export function buildPreparedTransaction(
  base64: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Result<PreparedTransaction> {
  // Validate base64
  if (!base64 || typeof base64 !== "string") {
    return err(createSdkError("InvalidTransaction", "base64 must be a non-empty string"));
  }

  // Validate base64 format and decode
  let decodedBytes: Buffer;
  try {
    decodedBytes = Buffer.from(base64, "base64");
    // Validate by re-encoding - if it doesn't match, base64 was invalid
    if (decodedBytes.toString("base64") !== base64) {
      return err(createSdkError("InvalidTransaction", "Invalid base64 format"));
    }
  } catch {
    return err(createSdkError("InvalidTransaction", "Invalid base64 format"));
  }

  // Check decoded bytes are not empty
  if (decodedBytes.length === 0) {
    return err(createSdkError("InvalidTransaction", "Decoded transaction is empty"));
  }

  // Validate blockhash
  if (!blockhash || typeof blockhash !== "string") {
    return err(createSdkError("InvalidTransaction", "blockhash must be a non-empty string"));
  }

  // Validate blockhash is not just whitespace
  if (blockhash.trim().length === 0) {
    return err(createSdkError("InvalidTransaction", "blockhash must not be whitespace-only"));
  }

  // Validate lastValidBlockHeight
  if (!Number.isInteger(lastValidBlockHeight) || lastValidBlockHeight <= 0) {
    return err(createSdkError("InvalidTransaction", "lastValidBlockHeight must be a positive integer"));
  }

  if (!Number.isSafeInteger(lastValidBlockHeight)) {
    return err(createSdkError("InvalidTransaction", "lastValidBlockHeight is not a safe integer"));
  }

  return ok({
    base64,
    blockhash,
    lastValidBlockHeight,
  });
}

/**
 * Check if a prepared transaction's blockhash is expired.
 *
 * @param prepared Transaction to check
 * @param currentBlockHeight Current slot/block height
 * @returns true if blockhash is expired
 */
export function isBlockhashExpired(
  prepared: PreparedTransaction,
  currentBlockHeight: number,
): boolean {
  return currentBlockHeight > prepared.lastValidBlockHeight;
}

/**
 * Simulate a transaction to check for errors and estimate cost.
 *
 * @param transport Resilient RPC transport
 * @param prepared Prepared transaction
 * @returns Simulation result with logs and cost estimate, or error
 */
export async function simulateTransaction(
  transport: RpcTransport,
  prepared: PreparedTransaction,
): Promise<Result<TransactionSimulationResult>> {
  try {
    const response = await transport.send<
      unknown[],
      { value?: { logs?: string[]; unitsConsumed?: number } } | { logs?: string[]; unitsConsumed?: number }
    >("simulateTransaction", [prepared.base64, { encoding: "base64" }]);

    // Parse response - handle both { value: {...} } and direct {...} shapes
    let data: unknown;

    if (!response || typeof response !== "object") {
      return err(createSdkError("InvalidResponse", "simulateTransaction response must be an object"));
    }

    // If response has "value", extract it; otherwise use response directly
    if ("value" in response) {
      if (response.value && typeof response.value === "object") {
        data = response.value;
      } else {
        return err(createSdkError("InvalidResponse", "simulateTransaction value must be an object"));
      }
    } else {
      data = response;
    }

    // Validate data is object-like (could be unknown)
    if (!data || typeof data !== "object") {
      return err(createSdkError("InvalidResponse", "simulateTransaction response must be an object"));
    }

    // Now safe to check properties
    const dataObj = data as Record<string, unknown>;

    if (!("logs" in dataObj) || !Array.isArray(dataObj.logs)) {
      return err(createSdkError("InvalidResponse", "simulateTransaction response must have logs array"));
    }

    // Validate every log entry is a string
    for (const log of dataObj.logs) {
      if (typeof log !== "string") {
        return err(createSdkError("InvalidResponse", "simulateTransaction logs must contain only strings"));
      }
    }

    // Validate unitsConsumed if present
    let unitsConsumed: number | undefined;
    if ("unitsConsumed" in dataObj) {
      if (typeof dataObj.unitsConsumed !== "number") {
        return err(createSdkError("InvalidResponse", "simulateTransaction unitsConsumed must be a number"));
      }
      unitsConsumed = dataObj.unitsConsumed;
    }

    // Build result, conditionally including unitsConsumed
    const result: TransactionSimulationResult = {
      logs: dataObj.logs as string[],
    };
    if (unitsConsumed !== undefined) {
      result.unitsConsumed = unitsConsumed;
    }

    return ok(result);
  } catch (error: unknown) {
    if (isKindOfSdkError(error)) {
      return err(error);
    }
    return err(mapTransportErrorToSdkError(error));
  }
}

/**
 * Send a prepared transaction via RPC.
 *
 * @param transport Resilient RPC transport
 * @param prepared Prepared transaction
 * @param options Send options
 * @returns Transaction signature and endpoint ID, or error
 */
export async function sendTransactionViaRpc(
  transport: RpcTransport,
  prepared: PreparedTransaction,
  options?: SendTransactionOptions,
): Promise<Result<SendTransactionResult>> {
  try {
    const sendOptions: {
      encoding: string;
      skipPreflight?: boolean;
      maxRetries?: number;
    } = {
      encoding: "base64",
    };

    if (options?.skipPreflight !== undefined) {
      sendOptions.skipPreflight = options.skipPreflight;
    }

    if (options?.maxRetries !== undefined) {
      sendOptions.maxRetries = options.maxRetries;
    }

    const response = await transport.send<
      unknown[],
      string | { result?: string; signature?: string }
    >("sendTransaction", [prepared.base64, sendOptions]);

    // Parse signature from various response shapes
    let signature: string | undefined;

    if (typeof response === "string") {
      signature = response;
    } else if (response && typeof response === "object") {
      if ("result" in response) {
        if (typeof response.result !== "string") {
          return err(createSdkError("InvalidResponse", "sendTransaction result must be a string"));
        }
        signature = response.result;
      } else if ("signature" in response) {
        if (typeof response.signature !== "string") {
          return err(createSdkError("InvalidResponse", "sendTransaction signature must be a string"));
        }
        signature = response.signature;
      }
    }

    if (!signature || signature.trim().length === 0) {
      return err(createSdkError("InvalidResponse", "sendTransaction response missing or empty signature"));
    }

    return ok({
      signature,
      endpointId: transport.endpointId,
    });
  } catch (error: unknown) {
    if (isKindOfSdkError(error)) {
      return err(error);
    }
    return err(mapTransportErrorToSdkError(error));
  }
}

/**
 * Send a transaction using resilient RPC (with retry and fallback).
 *
 * Checks blockhash expiry if currentBlockHeight is provided.
 *
 * @param transport Resilient RPC transport
 * @param prepared Prepared transaction
 * @param options Send options (including optional currentBlockHeight)
 * @returns Transaction signature and endpoint ID, or error
 */
export async function sendTransactionWithResilience(
  transport: RpcTransport,
  prepared: PreparedTransaction,
  options?: SendTransactionOptions,
): Promise<Result<SendTransactionResult>> {
  // Check if blockhash is expired, if currentBlockHeight is provided
  if (options?.currentBlockHeight !== undefined) {
    if (isBlockhashExpired(prepared, options.currentBlockHeight)) {
      return err(createSdkError("InvalidTransaction", "Blockhash has expired"));
    }
  }

  // Otherwise delegate to sendTransactionViaRpc
  return sendTransactionViaRpc(transport, prepared, options);
}

// ---------------------------------------------------------------------------
// Phase 3 — Low-level transaction send with SDK-controlled retry
// ---------------------------------------------------------------------------

/**
 * Send a raw base64 transaction via RPC with SDK-controlled retry defaults.
 *
 * Uses `maxRetries: 0` so the RPC node does not retry on our behalf —
 * the future lifecycle engine will control rebroadcast/resign itself.
 *
 * @param transport RPC transport
 * @param base64 Base64-encoded serialized transaction
 * @returns Transaction signature or error
 */
export async function sendTransactionRaw(
  transport: RpcTransport,
  base64: string,
): Promise<Result<string, SdkError>> {
  try {
    const response = await transport.send<
      unknown[],
      string | { result?: string; signature?: string }
    >("sendTransaction", [
      base64,
      {
        encoding: "base64",
        maxRetries: 0,
        skipPreflight: false,
        preflightCommitment: "processed",
      },
    ]);

    // Parse signature from various response shapes
    let signature: string | undefined;

    if (typeof response === "string") {
      signature = response;
    } else if (response && typeof response === "object") {
      if ("result" in response) {
        if (typeof response.result !== "string") {
          return err(createSdkError("InvalidResponse", "sendTransaction result must be a string"));
        }
        signature = response.result;
      } else if ("signature" in response) {
        if (typeof response.signature !== "string") {
          return err(createSdkError("InvalidResponse", "sendTransaction signature must be a string"));
        }
        signature = response.signature;
      }
    }

    if (!signature || signature.trim().length === 0) {
      return err(createSdkError("InvalidResponse", "sendTransaction response missing or empty signature"));
    }

    return ok(signature);
  } catch (error: unknown) {
    if (isKindOfSdkError(error)) {
      return err(error);
    }
    return err(mapTransportErrorToSdkError(error));
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — Pre-flight simulation guard
// ---------------------------------------------------------------------------

/**
 * Send a transaction with an optional pre-flight simulation guard.
 *
 * If `skipSimulation` is not `true`, calls `simulateTransaction` first.
 * If simulation reports an error, the transaction is NOT sent.
 *
 * When simulation passes, sends the transaction with `skipPreflight: true`
 * (the simulation already verified it) and `maxRetries: 0` for
 * SDK-controlled retry.
 *
 * If `skipSimulation === true`, skips simulation and sends with
 * `skipPreflight: false` so the RPC node still performs its own preflight.
 *
 * @param transport RPC transport
 * @param base64 Base64-encoded serialized transaction
 * @param options Optional guard configuration
 * @returns Transaction signature or error
 */
export async function sendWithPreflightGuard(
  transport: RpcTransport,
  base64: string,
  options?: SendWithPreflightGuardOptions,
): Promise<Result<string, SdkError>> {
  try {
    // If user explicitly requests to skip all preflight checks
    if (options?.skipPreflight === true) {
      const response = await transport.send<
        unknown[],
        string | { result?: string; signature?: string }
      >("sendTransaction", [
        base64,
        {
          encoding: "base64",
          maxRetries: 0,
          skipPreflight: true,
        },
      ]);

      return parseSignatureResponse(response);
    }

    // Default: run simulation first for safety
    if (options?.skipSimulation !== true) {
      // Run simulation first
      const simResponse = await transport.send<
        unknown[],
        { value?: { err?: unknown; logs?: string[] } }
      >("simulateTransaction", [
        base64,
        {
          encoding: "base64",
          commitment: "processed",
        },
      ]);

      // Check for simulation error
      const simValue =
        simResponse && typeof simResponse === "object" && "value" in simResponse
          ? (simResponse.value as { err?: unknown; logs?: string[] } | undefined)
          : undefined;

      if (simValue && simValue.err !== null && simValue.err !== undefined) {
        const logs = Array.isArray(simValue.logs) ? simValue.logs : [];
        return err(
          createSdkError(
            "InvalidTransaction",
            `Simulation failed: ${JSON.stringify(simValue.err)}`,
            {
              cause: {
                simulationError: simValue.err,
                logs,
              },
            },
          ),
        );
      }

      // Simulation succeeded — send with skipPreflight: true
      const response = await transport.send<
        unknown[],
        string | { result?: string; signature?: string }
      >("sendTransaction", [
        base64,
        {
          encoding: "base64",
          maxRetries: 0,
          skipPreflight: true,
        },
      ]);

      return parseSignatureResponse(response);
    }

    // skipSimulation === true — skip simulation, keep preflight for safety
    const response = await transport.send<
      unknown[],
      string | { result?: string; signature?: string }
    >("sendTransaction", [
      base64,
      {
        encoding: "base64",
        maxRetries: 0,
        skipPreflight: false,
        preflightCommitment: "processed",
      },
    ]);

    return parseSignatureResponse(response);
  } catch (error: unknown) {
    if (isKindOfSdkError(error)) {
      return err(error);
    }
    return err(mapTransportErrorToSdkError(error));
  }
}

/**
 * Parse a transaction signature from various RPC response shapes.
 * @internal
 */
function parseSignatureResponse(
  response: string | { result?: string; signature?: string } | null | undefined,
): Result<string, SdkError> {
  let signature: string | undefined;

  if (typeof response === "string") {
    signature = response;
  } else if (response && typeof response === "object") {
    if ("result" in response) {
      if (typeof response.result !== "string") {
        return err(createSdkError("InvalidResponse", "sendTransaction result must be a string"));
      }
      signature = response.result;
    } else if ("signature" in response) {
      if (typeof response.signature !== "string") {
        return err(createSdkError("InvalidResponse", "sendTransaction signature must be a string"));
      }
      signature = response.signature;
    }
  }

  if (!signature || signature.trim().length === 0) {
    return err(createSdkError("InvalidResponse", "sendTransaction response missing or empty signature"));
  }

  return ok(signature);
}
