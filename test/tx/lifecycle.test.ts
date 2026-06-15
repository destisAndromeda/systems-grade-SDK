/**
 * Tests for transaction lifecycle helpers and errors.
 */

import { describe, it, expect } from "vitest";
import {
  TransactionExpiredError,
  TransactionTimedOutError,
  isAlreadyProcessed,
  deriveSignatureFromWire,
  runTransactionLifecycle,
} from "../../src/index.js";
import type {
  LifecycleClock,
  TransactionLifecycleDeps,
  TransactionStatus,
  TrackedTransaction,
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

describe("runTransactionLifecycle", () => {
  // Fake clock implementation helper
  function createFakeClock(start = 0): LifecycleClock {
    let now = start;
    const sleeps: number[] = [];

    return {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
      getSleeps: () => sleeps,
    } as any;
  }

  interface MockDepsOptions {
    submit?: (wire: string) => Promise<string>;
    getStatuses?: (signatures: string[], searchTransactionHistory: boolean) => Promise<Array<TransactionStatus | null>>;
    getBlockHeight?: () => Promise<number>;
    resign?: (previous: TrackedTransaction, attempt: number) => Promise<{ wire: string; signature?: string; lastValidBlockHeight: number }>;
    deriveSignatureFromWire?: (wire: string) => string;
  }

  function createMockDeps(options: MockDepsOptions = {}, startClock = 0) {
    const clock = createFakeClock(startClock);
    const getStatusesCalls: Array<{ signatures: string[]; searchTransactionHistory: boolean }> = [];
    const submitCalls: string[] = [];
    const resignCalls: Array<{ previous: TrackedTransaction; attempt: number }> = [];

    const deps: TransactionLifecycleDeps = {
      clock,
      submit: async (wire) => {
        submitCalls.push(wire);
        if (options.submit) return options.submit(wire);
        return `sig-${wire}`;
      },
      getStatuses: async (signatures, searchTransactionHistory) => {
        getStatusesCalls.push({ signatures: [...signatures], searchTransactionHistory });
        if (options.getStatuses) return options.getStatuses(signatures, searchTransactionHistory);
        return signatures.map(() => null);
      },
      getBlockHeight: async () => {
        if (options.getBlockHeight) return options.getBlockHeight();
        return 100;
      },
      deriveSignatureFromWire: (wire) => {
        if (options.deriveSignatureFromWire) return options.deriveSignatureFromWire(wire);
        return `sig-${wire}`;
      },
    };

    if (options.resign) {
      deps.resign = async (previous, attempt) => {
        resignCalls.push({ previous, attempt });
        return options.resign!(previous, attempt);
      };
    }

    return {
      deps,
      clock,
      getStatusesCalls,
      submitCalls,
      resignCalls,
    };
  }

  it("tracks all signatures across resign epochs", async () => {
    let currentHeight = 100;
    const { deps, getStatusesCalls } = createMockDeps({
      getBlockHeight: async () => currentHeight,
      resign: async (previous, attempt) => {
        if (attempt === 1) {
          return { wire: "tx2", lastValidBlockHeight: 200 };
        } else {
          return { wire: "tx3", lastValidBlockHeight: 300 };
        }
      },
    });

    let callCount = 0;
    deps.getBlockHeight = async () => {
      callCount++;
      if (callCount === 1) {
        return 100;
      } else if (callCount === 2) {
        return 101;
      } else if (callCount === 3) {
        return 200;
      } else if (callCount === 4) {
        return 201;
      } else {
        return 301;
      }
    };

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 5,
        resignOnExpiry: true,
        maxResignatures: 2,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionExpiredError);

    const searchTrueCalls = getStatusesCalls.filter(c => c.searchTransactionHistory);
    expect(searchTrueCalls.length).toBe(6);
    expect(searchTrueCalls[0]!.signatures).toEqual(["sig-tx1"]);
    expect(searchTrueCalls[1]!.signatures).toEqual(["sig-tx1"]);
    expect(searchTrueCalls[2]!.signatures).toEqual(["sig-tx1", "sig-tx2"]);
    expect(searchTrueCalls[3]!.signatures).toEqual(["sig-tx1", "sig-tx2"]);
    expect(searchTrueCalls[4]!.signatures).toEqual(["sig-tx1", "sig-tx2", "sig-tx3"]);
    expect(searchTrueCalls[5]!.signatures).toEqual(["sig-tx1", "sig-tx2", "sig-tx3"]);
  });

  it("returns landed result if any previous signature lands", async () => {
    let currentHeight = 100;
    const { deps } = createMockDeps({
      getBlockHeight: async () => currentHeight,
      resign: async () => ({ wire: "tx2", lastValidBlockHeight: 200 }),
      getStatuses: async (sigs) => {
        if (sigs.includes("sig-tx2")) {
          return [
            { confirmationStatus: "confirmed", slot: 42 },
            null
          ];
        }
        return [null];
      }
    });

    let heightCalls = 0;
    deps.getBlockHeight = async () => {
      heightCalls++;
      if (heightCalls === 1) return 100;
      return 101;
    };

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 5,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps
    );

    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
    expect(result.status.slot).toBe(42);
    expect(result.tracked.map(t => t.signature)).toEqual(["sig-tx1", "sig-tx2"]);
  });

  it("does not resign until verified death passes two history sweeps", async () => {
    let currentHeight = 101;
    let resignCalled = false;
    const { deps, getStatusesCalls, clock } = createMockDeps({
      getBlockHeight: async () => currentHeight,
      resign: async () => {
        resignCalled = true;
        return { wire: "tx2", lastValidBlockHeight: 200 };
      },
      getStatuses: async (sigs) => {
        if (sigs.includes("sig-tx2")) {
          return [null, { confirmationStatus: "finalized", slot: 100 }];
        }
        return sigs.map(() => null);
      },
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 100,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps
    );

    const result = await promise;
    expect(resignCalled).toBe(true);

    const sweepCalls = getStatusesCalls.filter(c => c.searchTransactionHistory);
    expect(sweepCalls.length).toBe(2);
    expect(sweepCalls[0]!.signatures).toEqual(["sig-tx1"]);
    expect(sweepCalls[1]!.signatures).toEqual(["sig-tx1"]);
    const sleeps = (clock as any).getSleeps();
    expect(sleeps).toContain(100);
  });

  it("does not resign when first death sweep finds landed transaction", async () => {
    let currentHeight = 101;
    let resignCalled = false;
    const { deps } = createMockDeps({
      getBlockHeight: async () => currentHeight,
      resign: async () => {
        resignCalled = true;
        return { wire: "tx2", lastValidBlockHeight: 200 };
      },
      getStatuses: async (sigs, search) => {
        if (search) {
          return [{ confirmationStatus: "confirmed", slot: 50 }];
        }
        return [null];
      }
    });

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 50,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps
    );

    expect(resignCalled).toBe(false);
    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
  });

  it("does not resign when second death sweep finds landed transaction", async () => {
    let currentHeight = 101;
    let resignCalled = false;
    let sweepCount = 0;
    const { deps } = createMockDeps({
      getBlockHeight: async () => currentHeight,
      resign: async () => {
        resignCalled = true;
        return { wire: "tx2", lastValidBlockHeight: 200 };
      },
      getStatuses: async (sigs, search) => {
        if (search) {
          sweepCount++;
          if (sweepCount === 2) {
            return [{ confirmationStatus: "confirmed", slot: 55 }];
          }
        }
        return [null];
      }
    });

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 50,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps
    );

    expect(resignCalled).toBe(false);
    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
  });

  it("throws TransactionExpiredError only after verified death", async () => {
    let currentHeight = 101;
    const { deps } = createMockDeps({
      getBlockHeight: async () => currentHeight,
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 50,
        resignOnExpiry: false,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionExpiredError);
  });

  it("throws TransactionTimedOutError on timeout after final sweep", async () => {
    let now = 0;
    const sleeps: number[] = [];
    const clock: LifecycleClock = {
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    };

    let resignCalled = false;
    const { deps } = createMockDeps({
      resign: async () => {
        resignCalled = true;
        return { wire: "tx2", lastValidBlockHeight: 200 };
      }
    });
    deps.clock = clock;

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 2000,
        timeoutMs: 5000,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionTimedOutError);
    expect(resignCalled).toBe(false);
  });

  it("returns landed result if final timeout sweep finds landed transaction", async () => {
    let now = 0;
    const sleeps: number[] = [];
    const clock: LifecycleClock = {
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    };

    const { deps } = createMockDeps({
      getStatuses: async (sigs, search) => {
        if (search) {
          return [{ confirmationStatus: "confirmed", slot: 88 }];
        }
        return [null];
      }
    });
    deps.clock = clock;

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 2000,
        timeoutMs: 5000,
      },
      deps
    );

    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
    expect(result.status.slot).toBe(88);
  });

  it("treats AlreadyProcessed as submitted and continues polling", async () => {
    let submitCalledCount = 0;
    const { deps } = createMockDeps({
      submit: async () => {
        submitCalledCount++;
        throw new Error("This transaction has already been processed");
      },
      getStatuses: async () => {
        return [{ confirmationStatus: "finalized", slot: 123 }];
      }
    });

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
      },
      deps
    );

    expect(submitCalledCount).toBe(1);
    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("finalized");
  });

  it("uses injectable clock for all sleeps", async () => {
    let currentHeight = 100;
    const { deps, clock } = createMockDeps({
      getBlockHeight: async () => currentHeight,
    });

    let heightCalls = 0;
    deps.getBlockHeight = async () => {
      heightCalls++;
      if (heightCalls === 1) return 100;
      return 101;
    };

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 2000,
        deathGraceMs: 1000,
        resignOnExpiry: false,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionExpiredError);
    const sleeps = (clock as any).getSleeps();
    expect(sleeps).toEqual([2000, 1000]);
  });

  it("does not drop old signatures after resign", async () => {
    let currentHeight = 100;
    const { deps, getStatusesCalls } = createMockDeps({
      getBlockHeight: async () => currentHeight,
      resign: async (previous, attempt) => {
        if (attempt === 1) return { wire: "tx2", lastValidBlockHeight: 200 };
        return { wire: "tx3", lastValidBlockHeight: 300 };
      }
    });

    let heightCalls = 0;
    deps.getBlockHeight = async () => {
      heightCalls++;
      if (heightCalls === 1) return 100;
      if (heightCalls === 2) return 101;
      if (heightCalls === 3) return 200;
      if (heightCalls === 4) return 201;
      return 301;
    };

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 10,
        deathGraceMs: 5,
        resignOnExpiry: true,
        maxResignatures: 2,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionExpiredError);

    const lastCall = getStatusesCalls[getStatusesCalls.length - 1];
    expect(lastCall).toBeDefined();
    expect(lastCall!.signatures).toEqual(["sig-tx1", "sig-tx2", "sig-tx3"]);
  });

  it("periodically rebroadcasts tracked wires inside lifecycle", async () => {
    const { deps, submitCalls } = createMockDeps({
      getBlockHeight: async () => 100,
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 500,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionTimedOutError);

    // Initial submit (1) + rebroadcast at now=200 (1) + rebroadcast at now=400 (1) = 3 calls
    expect(submitCalls).toEqual(["tx1", "tx1", "tx1"]);
  });

  it("does not create new tracked signatures during rebroadcast", async () => {
    let submitCount = 0;
    const { deps, getStatusesCalls } = createMockDeps({
      getBlockHeight: async () => 100,
      submit: async (wire) => {
        submitCount++;
        return `sig-tx1-attempt-${submitCount}`;
      },
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 500,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionTimedOutError);

    // Verify all getStatuses calls only tracked "sig-tx1-attempt-1", and never "sig-tx1-attempt-2" or "sig-tx1-attempt-3"
    for (const call of getStatusesCalls) {
      expect(call.signatures).toEqual(["sig-tx1-attempt-1"]);
    }
  });

  it("ignores AlreadyProcessed during rebroadcast", async () => {
    let submitCount = 0;
    let getStatusesCount = 0;
    const { deps } = createMockDeps({
      getBlockHeight: async () => 100,
      submit: async (wire) => {
        submitCount++;
        if (submitCount > 1) {
          throw new Error("already processed");
        }
        return `sig-${wire}`;
      },
      getStatuses: async (sigs) => {
        getStatusesCount++;
        if (getStatusesCount === 4) {
          return [{ confirmationStatus: "confirmed", slot: 42 }];
        }
        return [null];
      },
    });

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 1000,
      },
      deps
    );

    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
  });

  it("ignores non-fatal rebroadcast errors and continues polling", async () => {
    let submitCount = 0;
    let getStatusesCount = 0;
    const { deps } = createMockDeps({
      getBlockHeight: async () => 100,
      submit: async (wire) => {
        submitCount++;
        if (submitCount > 1) {
          throw new Error("Network Error");
        }
        return `sig-${wire}`;
      },
      getStatuses: async (sigs) => {
        getStatusesCount++;
        if (getStatusesCount === 4) {
          return [{ confirmationStatus: "confirmed", slot: 42 }];
        }
        return [null];
      },
    });

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 1000,
      },
      deps
    );

    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
  });

  it("rebroadcasts without dropping old signatures", async () => {
    let height = 100;
    const { deps, submitCalls, getStatusesCalls } = createMockDeps({
      getBlockHeight: async () => height,
      resign: async (previous, attempt) => {
        return { wire: "tx2", lastValidBlockHeight: 300 };
      },
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 100 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        deathGraceMs: 50,
        resignOnExpiry: true,
        maxResignatures: 1,
        timeoutMs: 800,
      },
      deps
    );

    let heightCalls = 0;
    deps.getBlockHeight = async () => {
      heightCalls++;
      if (heightCalls >= 2) {
        return 101;
      }
      return 100;
    };

    await expect(promise).rejects.toThrow(TransactionTimedOutError);

    expect(submitCalls).toContain("tx1");
    expect(submitCalls).toContain("tx2");
    
    const lastCall = getStatusesCalls[getStatusesCalls.length - 1];
    expect(lastCall!.signatures).toEqual(["sig-tx1", "sig-tx2"]);
  });

  it("does not resign because rebroadcast failed", async () => {
    let resignCalled = false;
    let submitCount = 0;
    const { deps } = createMockDeps({
      getBlockHeight: async () => 100,
      submit: async (wire) => {
        submitCount++;
        if (submitCount > 1) {
          throw new Error("Network Error");
        }
        return `sig-${wire}`;
      },
      resign: async () => {
        resignCalled = true;
        return { wire: "tx2", lastValidBlockHeight: 200 };
      },
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 500,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionTimedOutError);
    expect(resignCalled).toBe(false);
  });

  it("does not timeout because rebroadcast failed", async () => {
    let submitCount = 0;
    let getStatusesCount = 0;
    const { deps } = createMockDeps({
      getBlockHeight: async () => 100,
      submit: async (wire) => {
        submitCount++;
        if (submitCount > 1) {
          throw new Error("Network Error");
        }
        return `sig-${wire}`;
      },
      getStatuses: async (sigs) => {
        getStatusesCount++;
        if (getStatusesCount === 4) {
          return [{ confirmationStatus: "confirmed", slot: 42 }];
        }
        return [null];
      },
    });

    const result = await runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 1000,
      },
      deps
    );

    expect(result.signature).toBe("sig-tx1");
    expect(result.status.confirmationStatus).toBe("confirmed");
  });

  it("uses injectable clock for rebroadcast timing", async () => {
    const { deps, clock } = createMockDeps({
      getBlockHeight: async () => 100,
    });

    const promise = runTransactionLifecycle(
      { wire: "tx1", lastValidBlockHeight: 200 },
      {
        pollIntervalMs: 100,
        rebroadcastIntervalMs: 200,
        timeoutMs: 500,
      },
      deps
    );

    await expect(promise).rejects.toThrow(TransactionTimedOutError);

    const sleeps = (clock as any).getSleeps();
    expect(sleeps).toContain(100);
  });
});

