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
 * Result of transaction simulation.
 */
export interface TransactionSimulationResult {
  logs: string[];
  unitsConsumed?: number;
}

/**
 * Result of sending a transaction.
 */
export interface SendTransactionResult {
  signature: string;
  endpointId: string;
}

/**
 * Options for sending a transaction.
 */
export interface SendTransactionOptions {
  skipPreflight?: boolean;
  maxRetries?: number;
  currentBlockHeight?: number;
}

/**
 * Transaction confirmation status union.
 */
export type TransactionConfirmationStatus =
  | { kind: "pending" }
  | { kind: "confirmed"; slot?: number }
  | { kind: "finalized"; slot?: number }
  | { kind: "failed"; error: string; slot?: number };

/**
 * Configuration for polling confirmation.
 */
export interface ConfirmationConfig {
  commitment?: "confirmed" | "finalized";
  pollIntervalMs: number;
  timeoutMs: number;
}

/**
 * Result of confirmation polling.
 */
export interface PollTransactionConfirmationResult {
  signature: string;
  status: TransactionConfirmationStatus;
  attempts: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Lifecycle primitives (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Clock interface for lifecycle timing.
 * Abstracts time and sleep for deterministic testing.
 */
export interface LifecycleClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/**
 * A transaction being tracked through the lifecycle.
 */
export interface TrackedTransaction {
  signature: string;
  wire: string;
  lastValidBlockHeight: number;
}

/**
 * Options for the pre-flight simulation guard.
 */
export interface SendWithPreflightGuardOptions {
  skipSimulation?: boolean;
}

/**
 * Error thrown when a transaction has verifiably expired
 * (block height exceeded lastValidBlockHeight).
 */
export class TransactionExpiredError extends Error {
  constructor(readonly signatures: string[]) {
    super(`Transaction expired after verified death: ${signatures.join(", ")}`);
    this.name = "TransactionExpiredError";
  }
}

/**
 * Error thrown when a transaction timed out without confirmation
 * but may still land on-chain.
 */
export class TransactionTimedOutError extends Error {
  constructor(readonly signatures: string[]) {
    super(`Transaction timed out; signatures may still land: ${signatures.join(", ")}`);
    this.name = "TransactionTimedOutError";
  }
}

/**
 * Minimal transaction status type for the lifecycle engine.
 */
export interface TransactionStatus {
  confirmationStatus?: "processed" | "confirmed" | "finalized";
  err?: unknown;
  slot?: number;
}

/**
 * Result of the transaction lifecycle.
 */
export interface TransactionLifecycleResult {
  signature: string;
  status: TransactionStatus;
  tracked: TrackedTransaction[];
}

/**
 * Dependencies for the transaction lifecycle.
 */
export interface TransactionLifecycleDeps {
  clock: LifecycleClock;

  submit(wire: string): Promise<string>;

  getStatuses(
    signatures: string[],
    searchTransactionHistory: boolean,
  ): Promise<Array<TransactionStatus | null>>;

  getBlockHeight(): Promise<number>;

  resign?(
    previous: TrackedTransaction,
    attempt: number,
  ): Promise<{
    wire: string;
    signature?: string;
    lastValidBlockHeight: number;
  }>;

  deriveSignatureFromWire(wire: string): string;
}

