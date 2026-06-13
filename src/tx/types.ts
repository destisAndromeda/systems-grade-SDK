/**
 * Transaction types.
 *
 * Data structures for preparing, sending, and confirming Solana transactions.
 */

/**
 * A prepared transaction ready to send.
 * Contains the serialized transaction and blockhash.
 */
export interface PreparedTransaction {
  base64: string; // Base64-encoded serialized transaction
  blockhash: string; // Blockhash used when building tx
  lastValidBlockHeight: number; // Last block height for which blockhash is valid
}

/**
 * Options for sending a transaction.
 */
export interface SendTransactionOptions {
  skipPreflight?: boolean;
  preflightCommitment?: string;
  maxRetries?: number;
}

/**
 * Result of sending a transaction.
 */
export interface SendTransactionResult {
  signature: string;
  endpointId: string;
}

/**
 * Status of a transaction on chain.
 */
export type TransactionStatus =
  | { kind: "pending"; signature: string }
  | { kind: "confirmed"; signature: string; slot: number }
  | { kind: "finalized"; signature: string; slot: number }
  | { kind: "failed"; signature: string; error?: string }
  | { kind: "timeout"; signature: string };

/**
 * Configuration for polling confirmation.
 */
export interface ConfirmationConfig {
  maxWaitMs: number; // Max time to wait for confirmation
  pollIntervalMs: number; // Interval between status checks
  commitment?: string; // "confirmed", "finalized", etc.
}

/**
 * Result of confirmation polling.
 */
export interface ConfirmationResult {
  signature: string;
  status: TransactionStatus;
  totalWaitMs: number;
}
