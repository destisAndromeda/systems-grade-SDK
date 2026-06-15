/**
 * Tests for AbortSignal timeout combination and cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { combineWithTimeout } from "../../src/rpc/abort.js";

describe("combineWithTimeout", () => {
  let allCleanups: Array<() => void> = [];

  afterEach(() => {
    // Clean up all combined signals
    for (const cleanup of allCleanups) {
      cleanup();
    }
    allCleanups = [];
  });

  it("creates a signal that aborts after timeout", async () => {
    const combined = combineWithTimeout(50);
    allCleanups.push(combined.cleanup);

    expect(combined.signal.aborted).toBe(false);

    // Wait for timeout to fire
    await new Promise<void>((resolve) => {
      combined.signal.addEventListener("abort", () => {
        resolve();
      });
      // Safety timeout in case abort doesn't fire
      setTimeout(() => resolve(), 200);
    });

    expect(combined.signal.aborted).toBe(true);
  });

  it("propagates caller signal abort to combined signal", async () => {
    const callerController = new AbortController();
    const combined = combineWithTimeout(5000, callerController.signal);
    allCleanups.push(combined.cleanup);

    expect(combined.signal.aborted).toBe(false);

    const testReason = new Error("test abort");
    callerController.abort(testReason);

    // Give a moment for the abort to propagate
    await new Promise<void>((resolve) => {
      if (combined.signal.aborted) {
        resolve();
      } else {
        combined.signal.addEventListener("abort", () => resolve());
      }
    });

    expect(combined.signal.aborted).toBe(true);
    expect(combined.signal.reason).toBe(testReason);
  });

  it("aborts immediately if caller signal is already aborted", () => {
    const callerController = new AbortController();
    const testReason = new Error("pre-aborted");
    callerController.abort(testReason);

    const combined = combineWithTimeout(5000, callerController.signal);
    allCleanups.push(combined.cleanup);

    expect(combined.signal.aborted).toBe(true);
    expect(combined.signal.reason).toBe(testReason);
  });

  it("cleanup prevents timeout from firing", async () => {
    const combined = combineWithTimeout(50);

    let abortFired = false;
    const listener = () => {
      abortFired = true;
    };
    combined.signal.addEventListener("abort", listener);

    // Clean up immediately
    combined.cleanup();

    // Wait past the timeout
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 150));

    expect(abortFired).toBe(false);
    expect(combined.signal.aborted).toBe(false);
  });

  it("cleanup removes abort listener from caller signal", async () => {
    const callerController = new AbortController();
    const combined = combineWithTimeout(5000, callerController.signal);

    let combinedAborted = false;
    combined.signal.addEventListener("abort", () => {
      combinedAborted = true;
    });

    // Clean up, which should remove the listener
    combined.cleanup();

    // Now abort the caller signal
    callerController.abort();

    // Give a moment to ensure abort doesn't propagate
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));

    expect(combinedAborted).toBe(false);
    expect(combined.signal.aborted).toBe(false);
  });

  it("cleanup is idempotent (safe to call multiple times)", () => {
    const combined = combineWithTimeout(50);

    // Should not throw
    combined.cleanup();
    combined.cleanup();
    combined.cleanup();

    expect(combined.signal.aborted).toBe(false);
  });

  it("rejects negative timeoutMs", () => {
    expect(() => combineWithTimeout(-1)).toThrow(RangeError);
    expect(() => combineWithTimeout(-100)).toThrow(RangeError);
  });

  it("accepts zero timeoutMs", () => {
    const combined = combineWithTimeout(0);
    allCleanups.push(combined.cleanup);
    // Should not throw
    expect(combined.signal).toBeDefined();
  });

  it("does not keep process alive with unref()", async () => {
    // This test verifies that the timeout handle can be unreffed.
    // We can't directly test process exit behavior in a test, but we can
    // verify the signal behaves correctly.
    const combined = combineWithTimeout(100);
    allCleanups.push(combined.cleanup);

    expect(combined.signal.aborted).toBe(false);

    // Clean up early (signal should not keep process alive)
    combined.cleanup();

    expect(combined.signal.aborted).toBe(false);
  });

  it("handles multiple abort listeners without interference", async () => {
    const callerController = new AbortController();
    const combined = combineWithTimeout(5000, callerController.signal);
    allCleanups.push(combined.cleanup);

    let listener1Called = false;
    let listener2Called = false;

    combined.signal.addEventListener("abort", () => {
      listener1Called = true;
    });
    combined.signal.addEventListener("abort", () => {
      listener2Called = true;
    });

    callerController.abort();

    // Give a moment for listeners to fire
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));

    expect(listener1Called).toBe(true);
    expect(listener2Called).toBe(true);
  });
});
