/**
 * Transaction confirmation utilities.
 *
 * Functions to poll for transaction confirmation status
 * and determine when a transaction is in a terminal state.
 */

import type { TransactionStatus, ConfirmationConfig, ConfirmationResult } from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Timer } from "../core/timer.js";
import type { Clock } from "../core/clock.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError } from "../core/error.js";

/**
 * Fetch current status of a transaction.
 *
 * Calls getSignatureStatus or similar RPC method.
 *
 * @param transport RPC transport
 * @param signature Transaction signature
 * @returns Current status or error
 */
export async function fetchTransactionStatus(
  transport: RpcTransport,
  signature: string,
): Promise<Result<TransactionStatus>> {
  // TODO: call getSignatureStatus RPC, parse response, return status or err
  throw new Error("TODO");
}

/**
 * Check if a transaction status is terminal (no longer waiting).
 *
 * @param status Transaction status
 * @returns true if status is confirmed, finalized, or failed
 */
export function isTerminalStatus(status: TransactionStatus): boolean {
  // TODO: return true if status.kind is confirmed, finalized, or failed
  throw new Error("TODO");
}

/**
 * Poll for transaction confirmation with exponential backoff.
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
): Promise<Result<ConfirmationResult>> {
  // TODO: poll fetchTransactionStatus until terminal status or timeout,
  // return ok with final status and elapsed time, or err(Timeout)
  throw new Error("TODO");
}
