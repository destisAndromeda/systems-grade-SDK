/**
 * Wallet adapter utilities.
 *
 * Functions to sign and send transactions via a connected wallet.
 */

import type { TransactionWallet, WalletSignResult, WalletSendResult } from "./types.js";
import type { PreparedTransaction, SendTransactionOptions } from "../tx/types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { Result } from "../core/result.js";
import { ok, err, isOk } from "../core/result.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import { sendTransactionViaRpc } from "../tx/send.js";

/**
 * Sign a transaction with a wallet.
 *
 * Validates base64 input and signed output before returning.
 *
 * @param wallet Wallet to sign with
 * @param base64 Base64-encoded transaction to sign
 * @returns Signed transaction result or error
 */
export async function signTransactionWithWallet(
  wallet: TransactionWallet,
  base64: string,
): Promise<Result<WalletSignResult>> {
  // Validate input base64
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

  try {
    const signedResult = await wallet.signTransaction(base64);

    // Validate returned signed base64
    if (!signedResult || typeof signedResult !== "object") {
      return err(
        createSdkError("InvalidTransaction", "Wallet returned invalid sign result", {
          cause: signedResult,
        }),
      );
    }

    const { signedBase64, publicKey } = signedResult;

    if (!signedBase64 || typeof signedBase64 !== "string") {
      return err(
        createSdkError(
          "InvalidTransaction",
          "Wallet returned invalid or empty signed transaction",
        ),
      );
    }

    // Validate signed base64 format and decode
    let signedDecodedBytes: Buffer;
    try {
      signedDecodedBytes = Buffer.from(signedBase64, "base64");
      // Validate by re-encoding
      if (signedDecodedBytes.toString("base64") !== signedBase64) {
        return err(
          createSdkError("InvalidTransaction", "Wallet returned invalid base64 format"),
        );
      }
    } catch {
      return err(
        createSdkError("InvalidTransaction", "Wallet returned invalid base64 format"),
      );
    }

    // Check signed decoded bytes are not empty
    if (signedDecodedBytes.length === 0) {
      return err(createSdkError("InvalidTransaction", "Signed transaction is empty"));
    }

    // Build result, only including publicKey if defined
    const result: WalletSignResult = {
      signedBase64,
    };

    if (publicKey !== undefined && typeof publicKey === "string") {
      result.publicKey = publicKey;
    }

    return ok(result);
  } catch (error: unknown) {
    if (isKindOfSdkError(error)) {
      return err(error);
    }
    return err(
      createSdkError("InvalidTransaction", `Wallet signing failed: ${String(error)}`, {
        cause: error,
      }),
    );
  }
}

/**
 * Sign a transaction with a wallet and send via RPC.
 *
 * @param wallet Wallet to sign with
 * @param transport RPC transport to send signed transaction
 * @param prepared Prepared transaction to sign and send
 * @param options Send transaction options
 * @returns Signature and endpoint ID, or error
 */
export async function sendViaWallet(
  wallet: TransactionWallet,
  transport: RpcTransport,
  prepared: PreparedTransaction,
  options?: SendTransactionOptions,
): Promise<Result<WalletSendResult>> {
  // Step 1: Sign transaction
  const signResult = await signTransactionWithWallet(wallet, prepared.base64);
  if (!isOk(signResult)) {
    return signResult as Result<WalletSendResult>;
  }

  const { signedBase64 } = signResult.value;

  // Step 2: Build signed prepared transaction
  const signedPrepared: PreparedTransaction = {
    base64: signedBase64,
    blockhash: prepared.blockhash,
    lastValidBlockHeight: prepared.lastValidBlockHeight,
  };

  // Step 3: Send via RPC
  const sendResult = await sendTransactionViaRpc(transport, signedPrepared, options);
  if (isOk(sendResult)) {
    return ok({
      signature: sendResult.value.signature,
      endpointId: sendResult.value.endpointId,
    });
  } else {
    return sendResult as Result<WalletSendResult>;
  }
}

