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
} from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError } from "../core/error.js";

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
  // TODO: validate base64 format, blockhash, and block height, return ok/err
  throw new Error("TODO");
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
  // TODO: return true if currentBlockHeight > lastValidBlockHeight
  throw new Error("TODO");
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
): Promise<Result<{ logs: string[]; unitsConsumed?: number }>> {
  // TODO: call simulateTransaction RPC, parse result, return ok/err
  throw new Error("TODO");
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
  // TODO: call sendTransaction RPC, extract signature, return ok/err
  throw new Error("TODO");
}

/**
 * Send a transaction using resilient RPC (with retry and fallback).
 *
 * Rejects if blockhash is already expired.
 *
 * @param prepared Prepared transaction
 * @param currentBlockHeight Current block height (to check expiry)
 * @param transport Resilient RPC transport
 * @param options Send options
 * @returns Transaction signature and endpoint ID, or error
 */
export async function sendTransactionWithResilience(
  prepared: PreparedTransaction,
  currentBlockHeight: number,
  transport: RpcTransport,
  options?: SendTransactionOptions,
): Promise<Result<SendTransactionResult>> {
  // TODO: check if blockhash expired, return err early if so,
  // else delegate to sendTransactionViaRpc
  throw new Error("TODO");
}
