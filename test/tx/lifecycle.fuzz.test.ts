import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  runTransactionLifecycle,
} from "../../src/tx/lifecycle.js";

import {
  TransactionExpiredError,
  TransactionTimedOutError,
  type LifecycleClock,
  type TransactionLifecycleDeps,
  type TransactionStatus,
  type TrackedTransaction,
} from "../../src/tx/types.js";

// Helper functions as described in the prompt
function createFakeClock(start = 0): LifecycleClock & { sleeps: number[] } {
  let now = start;
  const sleeps: number[] = [];

  return {
    sleeps,
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

function landedStatus(): TransactionStatus {
  return {
    confirmationStatus: "confirmed",
    err: null,
    slot: 1,
  };
}

function wireFor(signature: string): string {
  return `wire:${signature}`;
}

function signatureFromWire(wire: string): string {
  if (!wire.startsWith("wire:")) {
    throw new Error(`bad wire: ${wire}`);
  }
  return wire.slice("wire:".length);
}

describe("Transaction Lifecycle Fuzz / Property Tests", () => {
  // Property 1
  it("never returns success when all submits/statuses fail terminally", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (lastValidBlockHeight) => {
          const clock = createFakeClock();

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async () => {
              throw new Error("terminal submit failure");
            },
            getStatuses: async () => [],
            getBlockHeight: async () => 0,
            deriveSignatureFromWire: signatureFromWire,
          };

          await expect(
            runTransactionLifecycle(
              {
                wire: wireFor("sig-initial"),
                signature: "sig-initial",
                lastValidBlockHeight,
              },
              {
                timeoutMs: 10,
                pollIntervalMs: 1,
              },
              deps,
            ),
          ).rejects.toThrow("terminal submit failure");
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 2
  it("returns exactly the old signature when any old signature lands", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }), // number of resign epochs
        async (epochs) => {
          // Generate a landed index between 0 and epochs
          const landedIndex = Math.floor(Math.random() * (epochs + 1));
          
          const clock = createFakeClock();
          let currentEpoch = 0;
          const getStatusesCalls: string[][] = [];

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async (wire) => {
              return signatureFromWire(wire);
            },
            getStatuses: async (signatures, searchTransactionHistory) => {
              getStatusesCalls.push([...signatures]);
              if (currentEpoch === epochs) {
                const landedSig = `sig-${landedIndex}`;
                return signatures.map((sig) => {
                  if (sig === landedSig) {
                    return landedStatus();
                  }
                  return null;
                });
              }
              return signatures.map(() => null);
            },
            getBlockHeight: async () => {
              if (currentEpoch < epochs) {
                return (currentEpoch * 10) + 11;
              }
              return 0;
            },
            resign: async (previous, attempt) => {
              currentEpoch++;
              const nextEpoch = currentEpoch;
              return {
                wire: wireFor(`sig-${nextEpoch}`),
                signature: `sig-${nextEpoch}`,
                lastValidBlockHeight: (nextEpoch * 10) + 10,
              };
            },
            deriveSignatureFromWire: signatureFromWire,
          };

          const result = await runTransactionLifecycle(
            {
              wire: wireFor("sig-0"),
              signature: "sig-0",
              lastValidBlockHeight: 10,
            },
            {
              pollIntervalMs: 5,
              deathGraceMs: 2,
              resignOnExpiry: true,
              maxResignatures: epochs,
            },
            deps,
          );

          expect(result.signature).toBe(`sig-${landedIndex}`);
          expect(result.status.confirmationStatus).toBe("confirmed");
          
          // Verify that at the final poll, it checked all signatures including the older ones
          const lastCall = getStatusesCalls[getStatusesCalls.length - 1];
          expect(lastCall).toBeDefined();
          for (let i = 0; i <= epochs; i++) {
            expect(lastCall).toContain(`sig-${i}`);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 3
  it("never calls resign on timeout", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),  // timeoutMs
        fc.integer({ min: 1, max: 10 }),  // pollIntervalMs
        async (timeoutMs, pollIntervalMs) => {
          const clock = createFakeClock();
          let resignCalls = 0;

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async (wire) => signatureFromWire(wire),
            getStatuses: async (signatures) => signatures.map(() => null),
            getBlockHeight: async () => 0, // no expiry
            resign: async (previous, attempt) => {
              resignCalls++;
              return {
                wire: wireFor(`sig-${attempt}`),
                signature: `sig-${attempt}`,
                lastValidBlockHeight: 100,
              };
            },
            deriveSignatureFromWire: signatureFromWire,
          };

          await expect(
            runTransactionLifecycle(
              {
                wire: wireFor("sig-0"),
                signature: "sig-0",
                lastValidBlockHeight: 100,
              },
              {
                timeoutMs,
                pollIntervalMs,
                resignOnExpiry: true,
                maxResignatures: 1,
              },
              deps,
            ),
          ).rejects.toThrow(TransactionTimedOutError);

          expect(resignCalls).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 4
  it("calls resign only after two verified death sweeps", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), // deathGraceMs
        fc.integer({ min: 0, max: 5 }),  // lastValidBlockHeight
        async (deathGraceMs, lastValidBlockHeight) => {
          const clock = createFakeClock();
          const historySweeps: string[][] = [];
          let resignCalls = 0;
          let sweepsBeforeResign = 0;

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async (wire) => signatureFromWire(wire),
            getStatuses: async (signatures, searchTransactionHistory) => {
              if (searchTransactionHistory) {
                historySweeps.push([...signatures]);
              }
              return signatures.map(() => null);
            },
            getBlockHeight: async () => 999, // always expired
            resign: async (previous, attempt) => {
              resignCalls++;
              sweepsBeforeResign = historySweeps.length;
              return {
                wire: wireFor(`sig-${attempt}`),
                signature: `sig-${attempt}`,
                lastValidBlockHeight: previous.lastValidBlockHeight + 10,
              };
            },
            deriveSignatureFromWire: signatureFromWire,
          };

          await expect(
            runTransactionLifecycle(
              {
                wire: wireFor("sig-0"),
                signature: "sig-0",
                lastValidBlockHeight,
              },
              {
                pollIntervalMs: 5,
                deathGraceMs,
                resignOnExpiry: true,
                maxResignatures: 1,
              },
              deps,
            ),
          ).rejects.toThrow(TransactionExpiredError);

          expect(resignCalls).toBe(1);
          expect(sweepsBeforeResign).toBe(2);
          expect(clock.sleeps).toContain(deathGraceMs);
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 4 Variant A: If sweep 1 lands, resign must not be called
  it("does not call resign if the first death sweep lands", async () => {
    const clock = createFakeClock();
    let resignCalls = 0;
    let sweepCalls = 0;

    const deps: TransactionLifecycleDeps = {
      clock,
      submit: async (wire) => signatureFromWire(wire),
      getStatuses: async (signatures, search) => {
        if (search) {
          sweepCalls++;
          if (sweepCalls === 1) {
            return [landedStatus()];
          }
        }
        return signatures.map(() => null);
      },
      getBlockHeight: async () => 999, // always expired
      resign: async (previous, attempt) => {
        resignCalls++;
        return {
          wire: wireFor(`sig-${attempt}`),
          signature: `sig-${attempt}`,
          lastValidBlockHeight: previous.lastValidBlockHeight + 10,
        };
      },
      deriveSignatureFromWire: signatureFromWire,
    };

    const result = await runTransactionLifecycle(
      {
        wire: wireFor("sig-0"),
        signature: "sig-0",
        lastValidBlockHeight: 10,
      },
      {
        pollIntervalMs: 5,
        deathGraceMs: 2,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps,
    );

    expect(result.signature).toBe("sig-0");
    expect(result.status.confirmationStatus).toBe("confirmed");
    expect(resignCalls).toBe(0);
  });

  // Property 4 Variant B: If sweep 2 lands, resign must not be called
  it("does not call resign if the second death sweep lands", async () => {
    const clock = createFakeClock();
    let resignCalls = 0;
    let sweepCalls = 0;

    const deps: TransactionLifecycleDeps = {
      clock,
      submit: async (wire) => signatureFromWire(wire),
      getStatuses: async (signatures, search) => {
        if (search) {
          sweepCalls++;
          if (sweepCalls === 2) {
            return [landedStatus()];
          }
        }
        return signatures.map(() => null);
      },
      getBlockHeight: async () => 999, // always expired
      resign: async (previous, attempt) => {
        resignCalls++;
        return {
          wire: wireFor(`sig-${attempt}`),
          signature: `sig-${attempt}`,
          lastValidBlockHeight: previous.lastValidBlockHeight + 10,
        };
      },
      deriveSignatureFromWire: signatureFromWire,
    };

    const result = await runTransactionLifecycle(
      {
        wire: wireFor("sig-0"),
        signature: "sig-0",
        lastValidBlockHeight: 10,
      },
      {
        pollIntervalMs: 5,
        deathGraceMs: 2,
        resignOnExpiry: true,
        maxResignatures: 1,
      },
      deps,
    );

    expect(result.signature).toBe("sig-0");
    expect(result.status.confirmationStatus).toBe("confirmed");
    expect(resignCalls).toBe(0);
  });

  // Property 5
  it("keeps tracked signatures length equal to resign epochs plus one", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }), // resignEpochs
        async (resignEpochs) => {
          const clock = createFakeClock();

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async (wire) => signatureFromWire(wire),
            getStatuses: async (signatures) => signatures.map(() => null),
            getBlockHeight: async () => 999, // always expired
            resign: async (previous, attempt) => {
              return {
                wire: wireFor(`sig-${attempt}`),
                signature: `sig-${attempt}`,
                lastValidBlockHeight: previous.lastValidBlockHeight + 10,
              };
            },
            deriveSignatureFromWire: signatureFromWire,
          };

          try {
            await runTransactionLifecycle(
              {
                wire: wireFor("sig-0"),
                signature: "sig-0",
                lastValidBlockHeight: 10,
              },
              {
                pollIntervalMs: 5,
                deathGraceMs: 2,
                resignOnExpiry: true,
                maxResignatures: resignEpochs,
              },
              deps,
            );
            throw new Error("Should have thrown TransactionExpiredError");
          } catch (err) {
            expect(err).toBeInstanceOf(TransactionExpiredError);
            const expiredErr = err as TransactionExpiredError;
            expect(expiredErr.signatures.length).toBe(resignEpochs + 1);
            for (let i = 0; i <= resignEpochs; i++) {
              expect(expiredErr.signatures[i]).toBe(`sig-${i}`);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 6
  it("treats AlreadyProcessed as non-fatal and continues lifecycle", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // alreadyProcessedDuringSubmit
        async (alreadyProcessedDuringSubmit) => {
          const clock = createFakeClock();
          let submitCount = 0;
          let getStatusesCount = 0;

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async (wire) => {
              submitCount++;
              if (alreadyProcessedDuringSubmit && submitCount === 1) {
                throw new Error("This transaction has already been processed");
              }
              if (!alreadyProcessedDuringSubmit && submitCount > 1) {
                throw new Error("This transaction has already been processed");
              }
              return signatureFromWire(wire);
            },
            getStatuses: async (signatures) => {
              getStatusesCount++;
              if (getStatusesCount === 4) {
                return [landedStatus()];
              }
              return signatures.map(() => null);
            },
            getBlockHeight: async () => 0,
            deriveSignatureFromWire: signatureFromWire,
          };

          const result = await runTransactionLifecycle(
            {
              wire: wireFor("sig-0"),
              signature: "sig-0",
              lastValidBlockHeight: 100,
            },
            {
              pollIntervalMs: 5,
              rebroadcastIntervalMs: 10,
              timeoutMs: 100,
            },
            deps,
          );

          expect(result.signature).toBe("sig-0");
          expect(result.status.confirmationStatus).toBe("confirmed");
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 7
  it("continues polling old signatures after a new signature is tracked", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }), // resignEpochs
        async (resignEpochs) => {
          const clock = createFakeClock();
          const getStatusesCalls: string[][] = [];

          const deps: TransactionLifecycleDeps = {
            clock,
            submit: async (wire) => signatureFromWire(wire),
            getStatuses: async (signatures) => {
              getStatusesCalls.push([...signatures]);
              return signatures.map(() => null);
            },
            getBlockHeight: async () => 999, // always expired
            resign: async (previous, attempt) => {
              return {
                wire: wireFor(`sig-${attempt}`),
                signature: `sig-${attempt}`,
                lastValidBlockHeight: previous.lastValidBlockHeight + 10,
              };
            },
            deriveSignatureFromWire: signatureFromWire,
          };

          try {
            await runTransactionLifecycle(
              {
                wire: wireFor("sig-0"),
                signature: "sig-0",
                lastValidBlockHeight: 10,
              },
              {
                pollIntervalMs: 5,
                deathGraceMs: 2,
                resignOnExpiry: true,
                maxResignatures: resignEpochs,
              },
              deps,
            );
            throw new Error("Should have thrown TransactionExpiredError");
          } catch (err) {
            expect(err).toBeInstanceOf(TransactionExpiredError);
          }

          // Each resign epoch does: 1 normal poll, 2 sweeps = 3 calls to getStatuses
          // In total, for resignEpochs resignations, we have resignEpochs + 1 epochs.
          // Total expected calls is (resignEpochs + 1) * 3
          expect(getStatusesCalls.length).toBe((resignEpochs + 1) * 3);

          for (let i = 0; i < getStatusesCalls.length; i++) {
            const epoch = Math.floor(i / 3);
            const expectedLength = epoch + 1;
            expect(getStatusesCalls[i]!.length).toBe(expectedLength);
            for (let j = 0; j < expectedLength; j++) {
              expect(getStatusesCalls[i]).toContain(`sig-${j}`);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
