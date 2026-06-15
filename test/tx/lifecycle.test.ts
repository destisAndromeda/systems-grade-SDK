/**
 * Tests for transaction lifecycle helpers and errors.
 */

import { describe, it, expect } from "vitest";
import {
  TransactionExpiredError,
  TransactionTimedOutError,
  isAlreadyProcessed,
  deriveSignatureFromWire,
} from "../../src/index.js";
import { getBase58Decoder } from "@solana/codecs-strings";

describe("TransactionExpiredError", () => {
  it("stores signatures and has correct name/message", () => {
    const sigs = ["sig1", "sig2"];
    const err = new TransactionExpiredError(sigs);
    expect(err.name).toBe("TransactionExpiredError");
    expect(err.signatures).toEqual(sigs);
    expect(err.message).toContain("Transaction expired after verified death");
    expect(err.message).toContain("sig1, sig2");
  });
});

describe("TransactionTimedOutError", () => {
  it("stores signatures and has correct name/message", () => {
    const sigs = ["sig3"];
    const err = new TransactionTimedOutError(sigs);
    expect(err.name).toBe("TransactionTimedOutError");
    expect(err.signatures).toEqual(sigs);
    expect(err.message).toContain("Transaction timed out; signatures may still land");
    expect(err.message).toContain("sig3");
  });
});

describe("isAlreadyProcessed", () => {
  it("returns true for variants of already processed error messages", () => {
    expect(isAlreadyProcessed("already processed")).toBe(true);
    expect(isAlreadyProcessed("This transaction has already been processed")).toBe(true);
    expect(isAlreadyProcessed("Transaction already processed")).toBe(true);
    expect(isAlreadyProcessed("already been processed")).toBe(true);
    expect(isAlreadyProcessed(new Error("Transaction already processed"))).toBe(true);
    expect(isAlreadyProcessed({ message: "already processed" })).toBe(true);
  });

  it("returns false for unrelated error messages", () => {
    expect(isAlreadyProcessed("blockhash not found")).toBe(false);
    expect(isAlreadyProcessed("some other error")).toBe(false);
    expect(isAlreadyProcessed(new Error("network error"))).toBe(false);
    expect(isAlreadyProcessed({ message: "rate limit exceeded" })).toBe(false);
    expect(isAlreadyProcessed(null)).toBe(false);
    expect(isAlreadyProcessed(undefined)).toBe(false);
    expect(isAlreadyProcessed(123)).toBe(false);
  });
});

describe("deriveSignatureFromWire", () => {
  // Generate a valid mock 64-byte signature
  const dummySignatureBytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    dummySignatureBytes[i] = i;
  }
  // Construct wire: 1 signature (compact-u16 = 1), then 64-byte signature
  const validWireBytes = new Uint8Array(65);
  validWireBytes[0] = 1;
  validWireBytes.set(dummySignatureBytes, 1);

  const validWireBase64 = Buffer.from(validWireBytes).toString("base64");
  const expectedBase58Sig = getBase58Decoder().decode(dummySignatureBytes);

  it("works with Uint8Array wire", () => {
    const signature = deriveSignatureFromWire(validWireBytes);
    expect(signature).toBe(expectedBase58Sig);
  });

  it("works with base64 string wire", () => {
    const signature = deriveSignatureFromWire(validWireBase64);
    expect(signature).toBe(expectedBase58Sig);
  });

  it("rejects empty wire (Uint8Array)", () => {
    expect(() => deriveSignatureFromWire(new Uint8Array(0))).toThrow("Transaction wire is empty");
  });

  it("rejects empty wire (base64 string)", () => {
    expect(() => deriveSignatureFromWire("")).toThrow("Transaction wire is empty");
  });

  it("rejects zero signatures (Uint8Array)", () => {
    const zeroSigWire = new Uint8Array([0, 1, 2, 3]);
    expect(() => deriveSignatureFromWire(zeroSigWire)).toThrow("Transaction contains zero signatures");
  });

  it("rejects zero signatures (base64 string)", () => {
    const zeroSigWireBase64 = Buffer.from([0, 1, 2, 3]).toString("base64");
    expect(() => deriveSignatureFromWire(zeroSigWireBase64)).toThrow("Transaction contains zero signatures");
  });

  it("rejects truncated wire", () => {
    // 1 signature (compact-u16 = 1), but only 10 bytes of signature data
    const truncatedWire = new Uint8Array(11);
    truncatedWire[0] = 1;
    expect(() => deriveSignatureFromWire(truncatedWire)).toThrow("Transaction wire too short");
  });

  it("decodes multi-byte compact-u16 signature counts properly", () => {
    // Let's verify multi-byte compact-u16 decodes properly
    // 128 (0x80) is encoded as [0x80, 0x01] in compact-u16
    const multiByteWire = new Uint8Array(10);
    multiByteWire[0] = 0x80;
    multiByteWire[1] = 0x01;
    // Expected to read signatureCount = 128, bytesRead = 2, total size required = 2 + 128*64 = 8194 bytes
    expect(() => deriveSignatureFromWire(multiByteWire)).toThrow("Transaction wire too short");
  });
});
