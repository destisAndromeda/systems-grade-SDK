/**
 * Transaction confirmation utilities.
 *
 * Functions to poll for transaction confirmation status
 * and determine when a transaction is in a terminal state.
 */

import type {
  TransactionConfirmationStatus,
  ConfirmationConfig,
  PollTransactionConfirmationResult,
} from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Timer } from "../core/timer.js";
import type { Clock } from "../core/clock.js";
import type { Result } from "../core/result.js";
import type { SdkError } from "../core/error.js";
import { ok, err } from "../core/result.js";
import { createSdkError, isKindOfSdkError, isRetryableSdkError } from "../core/error.js";
import { mapTransportErrorToSdkError } from "../rpc/transport.js";

/**
 * Fetch current status of a transaction.
 *
 * Calls getSignatureStatuses RPC method.
 *
 * @param transport RPC transport
 * @param signature Transaction signature
 * @returns Current status or error
 */
export async function fetchTransactionStatus(
  transport: RpcTransport,
  signature: string,
): Promise<Result<TransactionConfirmationStatus, SdkError>> {
  // Validate signature
  if (!signature || typeof signature !== "string") {
    return err(createSdkError("InvalidTransaction", "Signature must be a non-empty string"));
  }

  // Validate signature is not just whitespace
  if (signature.trim().length === 0) {
    return err(createSdkError("InvalidTransaction", "Signature must not be whitespace-only"));
  }

  try {
    const response = await transport.send<
      unknown[],
      { value?: Array<{ confirmationStatus?: string; slot?: number; err?: unknown } | null> }
    >("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);

    // Parse response
    if (!response || typeof response !== "object" || !("value" in response)) {
      return err(createSdkError("InvalidResponse", "getSignatureStatuses response missing value field"));
    }

    const value = response.value;
    if (!Array.isArray(value) || value.length === 0) {
      return err(createSdkError("InvalidResponse", "getSignatureStatuses value is not a non-empty array"));
    }

    const statusEntry = value[0];

    // null means pending
    if (statusEntry === null) {
      return ok({ kind: "pending" });
    }

    if (!statusEntry || typeof statusEntry !== "object") {
      return err(createSdkError("InvalidResponse", "Invalid status entry"));
    }

    const confirmationStatus = (statusEntry as { confirmationStatus?: string }).confirmationStatus;
    const slot = (statusEntry as { slot?: number }).slot;
    const txErr = (statusEntry as { err?: unknown }).err;

    // Validate slot type if present
    if (slot !== undefined && typeof slot !== "number") {
      return err(createSdkError("InvalidResponse", "getSignatureStatuses slot must be a number"));
    }

    // Check for error first
    if (txErr !== null && txErr !== undefined) {
      const errorMsg = typeof txErr === "object" ? JSON.stringify(txErr) : String(txErr);
      const result: TransactionConfirmationStatus = { kind: "failed", error: errorMsg };
      if (slot !== undefined) {
        result.slot = slot;
      }
      return ok(result);
    }

    // Parse confirmation status
    switch (confirmationStatus) {
      case "confirmed": {
        const result: TransactionConfirmationStatus = { kind: "confirmed" };
        if (slot !== undefined) {
          result.slot = slot;
        }
        return ok(result);
      }
      case "finalized": {
        const result: TransactionConfirmationStatus = { kind: "finalized" };
        if (slot !== undefined) {
          result.slot = slot;
        }
        return ok(result);
      }
      case "processed":
      case "pending": {
        return ok({ kind: "pending" });
      }
      default:
        return err(createSdkError("InvalidResponse", `Unknown confirmationStatus: ${confirmationStatus}`));
    }
  } catch (error: unknown) {
    if (isKindOfSdkError(error)) {
      return err(error);
    }
    // mapTransportErrorToSdkError always returns an SdkError
    const mappedError = mapTransportErrorToSdkError(error);
    return err(mappedError);
  }
}

/**
 * Check if a transaction status is terminal (no longer waiting).
 *
 * @param status Transaction status
 * @param targetCommitment Target commitment level
 * @returns true if status is terminal for the target commitment
 */
export function isTerminalStatus(
  status: TransactionConfirmationStatus,
  targetCommitment?: "confirmed" | "finalized",
): boolean {
  const commitment = targetCommitment ?? "confirmed";

  switch (status.kind) {
    case "failed":
      return true;
    case "finalized":
      return true;
    case "confirmed":
      return commitment === "confirmed";
    case "pending":
      return false;
  }
}

/**
 * Poll for transaction confirmation with periodic checks.
 *
 * @param transport RPC transport
 * @param signature Transaction signature
 * @param config Polling configuration
 * @param deps.timer Timer for scheduling polls
 * @param deps.clock Clock for timeout calculation
 * @returns Final status or timeout error
 */
export async function pollTransactionConfirmation(
  transport: RpcTransport,
  signature: string,
  config: ConfirmationConfig,
  deps: { timer: Timer; clock: Clock },
): Promise<Result<PollTransactionConfirmationResult>> {
  const startedAtMs = deps.clock.now();
  const commitment = config.commitment ?? "confirmed";
  let attempts = 0;

  // Keep polling until terminal status or timeout
  while (true) {
    attempts++;

    // Fetch current status
    const statusResult = await fetchTransactionStatus(transport, signature);

    // If error, check if retryable
    if (!statusResult.ok) {
      if (isRetryableSdkError(statusResult.error)) {
        // Retryable error - check timeout and continue
        const elapsedMs = deps.clock.now() - startedAtMs;
        if (elapsedMs >= config.timeoutMs) {
          return err(createSdkError("Timeout", `Transaction confirmation timeout for signature: ${signature}`));
        }

        // Wait before retry
        await new Promise<void>((resolve) => {
          deps.timer.setTimeout(resolve, config.pollIntervalMs);
        });

        continue;
      }

      // Non-retryable error - return immediately
      return err(statusResult.error);
    }

    const status = statusResult.value;

    // Check if terminal
    if (isTerminalStatus(status, commitment)) {
      const elapsedMs = deps.clock.now() - startedAtMs;
      return ok({
        signature,
        status,
        attempts,
        elapsedMs,
      });
    }

    // Check timeout
    const elapsedMs = deps.clock.now() - startedAtMs;
    if (elapsedMs >= config.timeoutMs) {
      return err(createSdkError("Timeout", `Transaction confirmation timeout for signature: ${signature}`));
    }

    // Wait before next poll
    await new Promise<void>((resolve) => {
      deps.timer.setTimeout(resolve, config.pollIntervalMs);
    });
  }
}
