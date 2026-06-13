/**
 * Wallet adapter types.
 *
 * Minimal interface for signing transactions with a wallet.
 */

/**
 * Wallet interface for signing transactions.
 */
export interface TransactionWallet {
  publicKey?: string;

  /**
   * Sign a transaction.
   *
   * @param base64 Base64-encoded transaction to sign
   * @returns Signed transaction result or error
   */
  signTransaction(base64: string): Promise<WalletSignResult>;
}

/**
 * Result of signing a transaction with a wallet.
 */
export interface WalletSignResult {
  signedBase64: string;
  publicKey?: string;
}

/**
 * Result of sending a transaction via wallet.
 */
export interface WalletSendResult {
  signature: string;
  endpointId: string;
}

