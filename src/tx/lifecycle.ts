/**
 * Transaction lifecycle helpers.
 *
 * Low-level primitives for the future lifecycle engine.
 * Does NOT implement the full lifecycle engine — only isolated helpers
 * that can later be composed.
 */

import { getBase58Decoder } from "@solana/codecs-strings";
import type {
  TransactionLifecycleDeps,
  TransactionLifecycleResult,
  TrackedTransaction,
  TransactionStatus,
} from "./types.js";
import { TransactionExpiredError, TransactionTimedOutError } from "./types.js";


// ---------------------------------------------------------------------------
// isAlreadyProcessed
// ---------------------------------------------------------------------------

/**
 * Check if an error indicates the transaction was already processed.
 *
 * Matches conservatively against known Solana/RPC error messages.
 *
 * @param err Unknown value (Error, string, JSON-RPC-like object, etc.)
 * @returns true if the error signals already-processed status
 */
export function isAlreadyProcessed(err: unknown): boolean {
  const text = extractErrorMessage(err).toLowerCase();
  return (
    text.includes("already processed") ||
    text.includes("already been processed")
  );
}

/**
 * Extract a human-readable message from an unknown error value.
 * @internal
 */
function extractErrorMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (value && typeof value === "object") {
    // JSON-RPC-like { message: "..." }
    if ("message" in value && typeof (value as Record<string, unknown>).message === "string") {
      return (value as Record<string, unknown>).message as string;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// deriveSignatureFromWire
// ---------------------------------------------------------------------------

/**
 * Derive the first transaction signature from a Solana transaction wire.
 *
 * Accepts a base64-encoded wire string or a raw `Uint8Array`.
 * Decodes the compact-u16 signature count, then extracts the first
 * 64-byte signature and returns it as a base58 string.
 *
 * @param wire Base64 transaction string or raw transaction bytes
 * @returns Base58-encoded first signature
 * @throws Error if wire is malformed or contains zero signatures
 */
export function deriveSignatureFromWire(wire: string | Uint8Array): string {
  let bytes: Uint8Array;

  if (typeof wire === "string") {
    if (wire.length === 0) {
      throw new Error("Transaction wire is empty");
    }
    const buf = Buffer.from(wire, "base64");
    bytes = new Uint8Array(buf);
  } else {
    bytes = wire;
  }

  if (bytes.length === 0) {
    throw new Error("Transaction wire is empty");
  }

  // Parse compact-u16 signature count (shortvec encoding)
  const { value: signatureCount, bytesRead } = decodeCompactU16(bytes, 0);

  if (signatureCount === 0) {
    throw new Error("Transaction contains zero signatures");
  }

  const signatureStart = bytesRead;
  const signatureEnd = signatureStart + 64;

  if (bytes.length < signatureEnd) {
    throw new Error(
      `Transaction wire too short: expected at least ${signatureEnd} bytes, got ${bytes.length}`,
    );
  }

  const signatureBytes = bytes.slice(signatureStart, signatureEnd);

  // Decode the 64-byte signature as base58
  const decoder = getBase58Decoder();
  return decoder.decode(signatureBytes);
}

/**
 * Decode a compact-u16 (shortvec) value from a byte array.
 *
 * Solana uses a variable-length encoding for small integers:
 *  - If the high bit is clear, the byte is the value.
 *  - If the high bit is set, the low 7 bits contribute to the value
 *    and the next byte is read.
 *  - Up to 3 bytes for values up to 0x3FFF.
 *
 * @internal
 */
function decodeCompactU16(
  bytes: Uint8Array,
  offset: number,
): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;

  for (let shift = 0; shift < 21; shift += 7) {
    if (offset + bytesRead >= bytes.length) {
      throw new Error("Transaction wire truncated: incomplete compact-u16");
    }

    const byte = bytes[offset + bytesRead]!;
    bytesRead++;

    value |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return { value, bytesRead };
    }
  }

  throw new Error("Malformed compact-u16: too many continuation bytes");
}

/**
 * Find if any tracked transaction has landed.
 *
 * @param tracked List of tracked transactions
 * @param statuses List of corresponding transaction statuses
 */
export function findLanded(
  tracked: TrackedTransaction[],
  statuses: Array<TransactionStatus | null>,
): TransactionLifecycleResult | undefined {
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    if (status) {
      const isErrFree = status.err === null || status.err === undefined;
      const hasConfirmationStatus = status.confirmationStatus !== undefined;
      if (isErrFree && (hasConfirmationStatus || status.slot !== undefined || Object.keys(status).length > 0)) {
        return {
          signature: tracked[i]!.signature,
          status,
          tracked: [...tracked],
        };
      }
    }
  }
  return undefined;
}

/**
 * Run correctness-critical transaction lifecycle.
 */
export async function runTransactionLifecycle(
  initial: {
    wire: string;
    signature?: string;
    lastValidBlockHeight: number;
  },
  options: {
    pollIntervalMs?: number;
    rebroadcastIntervalMs?: number;
    deathGraceMs?: number;
    timeoutMs?: number;
    resignOnExpiry?: boolean;
    maxResignatures?: number;
  },
  deps: TransactionLifecycleDeps,
): Promise<TransactionLifecycleResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const rebroadcastIntervalMs = options.rebroadcastIntervalMs ?? 2_000;
  const deathGraceMs = options.deathGraceMs ?? 1_000;
  const timeoutMs = options.timeoutMs;
  const resignOnExpiry = options.resignOnExpiry ?? false;
  const maxResignatures = options.maxResignatures ?? 0;

  const startedAt = deps.clock.now();
  let lastRebroadcastAt = startedAt;
  const tracked: TrackedTransaction[] = [];
  let resignAttempt = 0;

  // Submit and track the initial transaction
  await submitAndTrack(initial);

  async function submitAndTrack(input: {
    wire: string;
    signature?: string;
    lastValidBlockHeight: number;
  }): Promise<void> {
    let signature = input.signature;
    if (!signature) {
      signature = deps.deriveSignatureFromWire(input.wire);
    }

    try {
      const submittedSignature = await deps.submit(input.wire);
      signature = submittedSignature || signature;
    } catch (err) {
      if (isAlreadyProcessed(err)) {
        signature = deps.deriveSignatureFromWire(input.wire);
      } else {
        throw err;
      }
    }

    const exists = tracked.some((t) => t.signature === signature);
    if (!exists) {
      tracked.push({
        signature,
        wire: input.wire,
        lastValidBlockHeight: input.lastValidBlockHeight,
      });
    }
  }

  async function rebroadcastKnownWires(): Promise<void> {
    const wiresToRebroadcast = [...tracked].reverse();
    for (const tx of wiresToRebroadcast) {
      try {
        await deps.submit(tx.wire);
      } catch (err) {
        if (isAlreadyProcessed(err)) {
          continue;
        }
        // Ignore non-fatal rebroadcast errors.
        // Lifecycle will keep polling statuses and handle expiry/timeout correctly.
        continue;
      }
    }
  }

  function isTimedOut(): boolean {
    if (timeoutMs === undefined) return false;
    return (deps.clock.now() - startedAt) >= timeoutMs;
  }

  while (true) {
    // 1. Check timeout
    if (isTimedOut()) {
      const finalSweep = await deps.getStatuses(
        tracked.map((t) => t.signature),
        true,
      );
      const landed = findLanded(tracked, finalSweep);
      if (landed) return landed;
      throw new TransactionTimedOutError(tracked.map((t) => t.signature));
    }

    // 2. Poll statuses (normal check)
    const statuses = await deps.getStatuses(
      tracked.map((t) => t.signature),
      false,
    );
    const landed = findLanded(tracked, statuses);
    if (landed) return landed;

    // 3. Check block height / expiry
    const currentBlockHeight = await deps.getBlockHeight();
    const latestTracked = tracked[tracked.length - 1]!;

    if (currentBlockHeight > latestTracked.lastValidBlockHeight) {
      // Expiry triggered, run verified death
      const signatures = tracked.map((t) => t.signature);
      const sweep1 = await deps.getStatuses(signatures, true);
      const landed1 = findLanded(tracked, sweep1);
      if (landed1) return landed1;

      // Sleep death grace using the injectable clock
      await deps.clock.sleep(deathGraceMs);

      // Check timeout again after sleep in case it occurred during the sleep
      if (isTimedOut()) {
        const finalSweep = await deps.getStatuses(
          tracked.map((t) => t.signature),
          true,
        );
        const landed = findLanded(tracked, finalSweep);
        if (landed) return landed;
        throw new TransactionTimedOutError(tracked.map((t) => t.signature));
      }

      const sweep2 = await deps.getStatuses(signatures, true);
      const landed2 = findLanded(tracked, sweep2);
      if (landed2) return landed2;

      // Death verified. Now either resign or throw expiry error
      // Check timeout first before resigning/throwing expiry
      if (isTimedOut()) {
        throw new TransactionTimedOutError(tracked.map((t) => t.signature));
      }

      if (resignOnExpiry && deps.resign && resignAttempt < maxResignatures) {
        resignAttempt++;
        const resigned = await deps.resign(latestTracked, resignAttempt);
        await submitAndTrack(resigned);
        continue;
      } else {
        throw new TransactionExpiredError(tracked.map((t) => t.signature));
      }
    }

    // 4. Periodic rebroadcast of known wires
    const now = deps.clock.now();
    if (rebroadcastIntervalMs > 0 && now - lastRebroadcastAt >= rebroadcastIntervalMs) {
      await rebroadcastKnownWires();
      lastRebroadcastAt = now;
    }

    // 5. Sleep pollIntervalMs
    await deps.clock.sleep(pollIntervalMs);
  }
}

