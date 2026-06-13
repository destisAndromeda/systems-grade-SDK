/**
 * Wallet adapter utilities.
 *
 * Functions to sign and send transactions via a connected wallet.
 */

import type { WalletAdapter } from "./types";
import type { RpcTransport } from "../rpc/types";
import type { Result } from "../core/result";
import { ok, err } from "../core/result";

/**
 * Sign a transaction with a wallet adapter.
 *
 * @param wallet Wallet adapter
 * @param transactionBase64 Base64-encoded transaction
 * @returns Signed transaction or error
 */
export async function signTransactionWithWallet(
  wallet: WalletAdapter,
  transactionBase64: string,
): Promise<Result<string>> {
  // TODO: call wallet.signTransaction, handle errors, return ok/err
  throw new Error("TODO");
}

/**
 * Sign and send a transaction via wallet + resilient RPC.
 *
 * @param wallet Wallet adapter
 * @param transactionBase64 Base64-encoded transaction
 * @param transport Resilient RPC transport
 * @returns Signature or error
 */
export async function sendViaWallet(
  wallet: WalletAdapter,
  transactionBase64: string,
  transport: RpcTransport,
): Promise<Result<string>> {
  // TODO: sign transaction, send via transport, return signature or error
  throw new Error("TODO");
}
