/**
 * Transaction lifecycle helpers.
 *
 * Low-level primitives for the future lifecycle engine.
 * Does NOT implement the full lifecycle engine — only isolated helpers
 * that can later be composed.
 */

import { getBase58Decoder } from "@solana/codecs-strings";

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
