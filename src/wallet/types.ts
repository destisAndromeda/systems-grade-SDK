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

/**
 * Minimal structural interface for legacy Solana wallet adapters.
 *
 * Intentionally does not import @solana/wallet-adapter; any object
 * satisfying this shape is accepted (structural typing).
 *
 * T is the adapter's transaction type (must be serializable).
 */
export interface LegacyWalletAdapter<T extends { serialize(): Uint8Array } = { serialize(): Uint8Array }> {
  name?: string;
  signTransaction?(transaction: T): Promise<T>;
}

