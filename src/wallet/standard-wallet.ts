/**
 * Wallet Standard adapter for Solana reliability SDK.
 */

import type { TransactionWallet, WalletSignResult } from "./types.js";
import { createSdkError } from "../core/error.js";

export const SOLANA_SIGN_TRANSACTION = "solana:signTransaction";
export const SOLANA_SIGN_AND_SEND_TRANSACTION = "solana:signAndSendTransaction";

export interface WalletStandardAccountLike {
  readonly address: string;
  readonly publicKey: Uint8Array;
  readonly chains: readonly string[];
  readonly features: readonly string[];
  readonly label?: string;
  readonly icon?: string;
}

export interface WalletStandardWalletLike {
  readonly version: string;
  readonly name: string;
  readonly icon?: string;
  readonly chains: readonly string[];
  readonly features: Record<string, any>;
  readonly accounts: readonly WalletStandardAccountLike[];
}

/**
 * Adapts a Wallet Standard Solana wallet, such as Phantom-compatible wallets exposing solana:signTransaction, to the SDK TransactionWallet interface. The wallet signs the transaction and the SDK still handles resilient RPC submission.
 */
export function createWalletStandardTransactionWallet(
  wallet: WalletStandardWalletLike,
  options?: {
    chain?: string;
    account?: WalletStandardAccountLike;
  },
): TransactionWallet {
  if (!wallet) {
    throw createSdkError("InvalidConfig", "Wallet is required");
  }
  if (!wallet.accounts || !Array.isArray(wallet.accounts)) {
    throw createSdkError("InvalidConfig", "Wallet must have an accounts array");
  }

  // Pick options.account if provided, otherwise pick the first Solana-capable account
  let selectedAccount: WalletStandardAccountLike | undefined;
  if (options?.account) {
    selectedAccount = options.account;
  } else {
    // Prefer an account whose chains include a "solana:" chain,
    // and prefer an account whose features include "solana:signTransaction".
    const solanaCapableAccounts = wallet.accounts.filter(
      (acc: WalletStandardAccountLike) =>
        (acc.chains && acc.chains.some((c: string) => c.startsWith("solana:"))) ||
        (acc.features && acc.features.includes(SOLANA_SIGN_TRANSACTION))
    );

    if (solanaCapableAccounts.length === 0) {
      throw createSdkError("InvalidConfig", "No Solana-capable accounts found in the wallet");
    }

    const accountWithSignFeature = solanaCapableAccounts.find(
      (acc: WalletStandardAccountLike) => acc.features && acc.features.includes(SOLANA_SIGN_TRANSACTION)
    );

    selectedAccount = accountWithSignFeature || solanaCapableAccounts[0];
  }

  if (!selectedAccount) {
    throw createSdkError("InvalidConfig", "No account selected");
  }

  // Validate that the selected account is Solana-capable
  const hasSolanaChain = selectedAccount.chains && selectedAccount.chains.some((c: string) => c.startsWith("solana:"));
  const hasSignFeature = selectedAccount.features && selectedAccount.features.includes(SOLANA_SIGN_TRANSACTION);
  if (!hasSolanaChain && !hasSignFeature) {
    throw createSdkError(
      "InvalidConfig",
      "Selected account is not Solana-capable (requires a solana: chain or solana:signTransaction feature)"
    );
  }

  // Use options.chain if provided, otherwise choose the first account chain starting with "solana:"
  let selectedChain: string;
  if (options?.chain) {
    selectedChain = options.chain;
  } else {
    const chain = selectedAccount.chains && selectedAccount.chains.find((c: string) => c.startsWith("solana:"));
    if (!chain) {
      throw createSdkError(
        "InvalidConfig",
        "Selected account does not have a solana: chain, and no chain option was provided"
      );
    }
    selectedChain = chain;
  }

  if (!selectedChain.startsWith("solana:")) {
    throw createSdkError("InvalidConfig", `Selected chain ${selectedChain} is not a Solana chain`);
  }

  return {
    publicKey: selectedAccount.address,

    async signTransaction(base64: string): Promise<WalletSignResult> {
      // Re-verify the feature at execution time in case of state changes
      const signFeature = wallet.features[SOLANA_SIGN_TRANSACTION];
      if (!signFeature || typeof signFeature.signTransaction !== "function") {
        throw createSdkError("InvalidTransaction", "Wallet does not support the 'solana:signTransaction' feature");
      }

      if (!base64 || typeof base64 !== "string") {
        throw createSdkError("InvalidTransaction", "base64 must be a non-empty string");
      }

      // Decode base64 into a new Uint8Array to prevent in-place mutation
      let decodedBytes: Uint8Array;
      try {
        const buf = Buffer.from(base64, "base64");
        if (buf.length === 0) {
          throw createSdkError("InvalidTransaction", "Decoded transaction is empty");
        }
        decodedBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      } catch (err: unknown) {
        throw createSdkError("InvalidTransaction", `Invalid base64 transaction: ${String(err)}`);
      }

      const inputs = [
        {
          transaction: decodedBytes,
          account: selectedAccount,
          chain: selectedChain,
        },
      ];

      let outputs: any;
      try {
        outputs = await signFeature.signTransaction(...inputs);
      } catch (err: unknown) {
        throw createSdkError("InvalidTransaction", `Wallet signTransaction call failed: ${String(err)}`);
      }

      if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
        throw createSdkError("InvalidTransaction", "Wallet signTransaction returned empty or invalid outputs");
      }

      const firstOutput = outputs[0];
      if (!firstOutput || !(firstOutput.signedTransaction instanceof Uint8Array)) {
        throw createSdkError("InvalidTransaction", "Wallet signTransaction output is missing signedTransaction bytes");
      }

      const signedBase64 = Buffer.from(
        firstOutput.signedTransaction.buffer,
        firstOutput.signedTransaction.byteOffset,
        firstOutput.signedTransaction.length
      ).toString("base64");

      return {
        signedBase64,
        publicKey: selectedAccount.address,
      };
    },
  };
}
