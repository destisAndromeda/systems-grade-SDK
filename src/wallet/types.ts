/**
 * Wallet adapter types.
 *
 * Interface for connecting wallets to the SDK.
 * Abstracts wallet signing so tests can use fake wallets.
 */

/**
 * Wallet adapter interface.
 * Handles signing transactions and returning public key.
 */
export interface WalletAdapter {
  /**
   * Get the wallet's public key (as base58 string).
   */
  getPublicKey(): string;

  /**
   * Sign a message.
   *
   * @param message Message bytes to sign
   * @returns Signature bytes, or error
   */
  signMessage(message: Uint8Array): Promise<Uint8Array>;

  /**
   * Sign a transaction.
   *
   * @param transaction Base64-encoded transaction to sign
   * @returns Base64-encoded signed transaction, or error
   */
  signTransaction(transaction: string): Promise<string>;
}

/**
 * Options for wallet-based transaction sending.
 */
export interface WalletSendOptions {
  skipPreflight?: boolean;
  preflightCommitment?: string;
}
