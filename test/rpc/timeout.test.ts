/**
 * Tests for timeout utilities.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { isWithinTimeout, createTimeoutError, withTimeout } from "../../src/rpc/timeout.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";
import { createFakeTimer } from "../../src/testing/fake-timer.js";

describe("isWithinTimeout", () => {
  it("returns true when elapsed is below timeout", () => {
    expect(isWithinTimeout(0, 50, 100)).toBe(true);
  });

  it("returns true when elapsed equals timeout", () => {
    expect(isWithinTimeout(0, 100, 100)).toBe(true);
  });

  it("returns false when elapsed exceeds timeout", () => {
    expect(isWithinTimeout(0, 150, 100)).toBe(false);
  });

  it("returns true when timeoutMs is undefined", () => {
    expect(isWithinTimeout(0, 100)).toBe(true);
  });

  it("handles non-zero start time", () => {
    expect(isWithinTimeout(1000, 1050, 100)).toBe(true);
    expect(isWithinTimeout(1000, 1150, 100)).toBe(false);
  });
});

describe("createTimeoutError", () => {
  it("creates error with kind Timeout", () => {
    const error = createTimeoutError("getBlockHeight", 5000, 5000);
    expect(error.kind).toBe("Timeout");
  });

  it("timeout error is retryable", () => {
    const error = createTimeoutError("getBlockHeight", 1000, 5000);
    expect(error.retryable).toBe(true);
  });

  it("includes custom message if provided", () => {
    const error = createTimeoutError("getBlockHeight", 5000, 5000);
    expect(error.message).toContain("getBlockHeight");
    expect(error.message).toContain("5000");
  });

  it("extends Error", () => {
    const error = createTimeoutError("getBlockHeight", 1000, 5000);
    expect(error instanceof Error).toBe(true);
  });
});

describe("withTimeout", () => {
  let clock: ReturnType<typeof createFakeClock>;
  let timer: ReturnType<typeof createFakeTimer>;

  beforeEach(() => {
    clock = createFakeClock(0);
    timer = createFakeTimer();
  });

  it("resolves with original value when promise resolves before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = withTimeout(promise, 1000, timer, clock, "test");
    await expect(result).resolves.toBe("success");
  });

  it("rejects with original error when promise rejects before timeout", async () => {
    const error = new Error("original error");
    const promise = new Promise<string>((resolve, reject) => {
      reject(error);
    });
    const result = withTimeout(promise, 1000, timer, clock, "test");
    await expect(result).rejects.toBe(error);
  });

  it("rejects with Timeout error when timeout fires first", async () => {
    const deferred = { resolve: null as any, reject: null as any };
    const promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    const result = withTimeout(promise, 100, timer, clock, "test");

    // Advance time past timeout
    clock.advance(101);
    timer.flushAll();

    await expect(result).rejects.toMatchObject({ kind: "Timeout" });
  });

  it("clears scheduled timer after successful resolution", async () => {
    const promise = Promise.resolve("success");
    await withTimeout(promise, 1000, timer, clock, "test");
    expect(timer.pendingCount()).toBe(0);
  });

  it("clears scheduled timer after rejection", async () => {
    const error = new Error("test error");
    const promise = new Promise<string>((resolve, reject) => {
      reject(error);
    });
    const result = withTimeout(promise, 1000, timer, clock, "test");
    try {
      await result;
    } catch {
      // Expected
    }
    expect(timer.pendingCount()).toBe(0);
  });

  it("does not create timer when timeout is undefined/null", async () => {
    const promise = Promise.resolve("success");
    await withTimeout(promise, undefined, timer, clock, "test");
    expect(timer.pendingCount()).toBe(0);
  });

  it("works with fake timer deterministically", async () => {
    const deferred = { resolve: null as any, reject: null as any };
    const promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    const result = withTimeout(promise, 100, timer, clock, "test");

    // Simulate timeout
    timer.advanceAndFlush(100, clock);

    await expect(result).rejects.toMatchObject({ kind: "Timeout" });
  });

  it("does not call timeout callback after promise already settled", async () => {
    let timeoutCalled = false;
    const originalSetTimeout = timer.setTimeout.bind(timer);
    timer.setTimeout = (fn: () => void, ms: number) => {
      const wrappedFn = () => {
        timeoutCalled = true;
        fn();
      };
      return originalSetTimeout(wrappedFn, ms);
    };

    const promise = Promise.resolve("success");
    await withTimeout(promise, 1000, timer, clock, "test");

    // Advance time (should not call timeout)
    timer.advanceAndFlush(2000, clock);

    // Timeout should not have been called since promise resolved before it
    expect(timeoutCalled).toBe(false);
  });

  it("handles promise resolution within timeout", async () => {
    const deferred = { resolve: null as any, reject: null as any };
    const promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    const result = withTimeout(promise, 100, timer, clock, "test");

    // Resolve promise before timeout
    deferred.resolve("value");
    const value = await result;

    expect(value).toBe("value");
    expect(timer.pendingCount()).toBe(0);
  });
});
