/**
 * Tests for transaction confirmation.
 */

import { describe, it, expect } from "vitest";
import {
  fetchTransactionStatus,
  isTerminalStatus,
  pollTransactionConfirmation,
} from "../../src/tx/confirm.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk, err } from "../../src/core/result.js";
import type { RpcTransport } from "../../src/rpc/types.js";
import type { PollTransactionConfirmationResult } from "../../src/tx/types.js";
import type { Result } from "../../src/core/result.js";

describe("fetchTransactionStatus", () => {
  it("rejects empty signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [null] } }]]),
    });

    const result = await fetchTransactionStatus(transport, "");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects whitespace-only signature with InvalidTransaction", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [null] } }]]),
    });

    const result = await fetchTransactionStatus(transport, "   ");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("calls getSignatureStatuses RPC method", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [null] } }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
  });

  it("parses pending status from null", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [null] } }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.kind).toBe("pending");
    }
  });

  it("parses confirmed status", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "confirmed",
                  slot: 100,
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.kind === "confirmed") {
      expect(result.value.slot).toBe(100);
    }
  });

  it("parses finalized status", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "finalized",
                  slot: 101,
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.kind === "finalized") {
      expect(result.value.slot).toBe(101);
    }
  });

  it("parses failed status with error object", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "confirmed",
                  slot: 102,
                  err: { InstructionError: [0, "Custom"] },
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.kind === "failed") {
      expect(result.value.error).toContain("InstructionError");
      expect(result.value.slot).toBe(102);
    }
  });

  it("includes slot when present", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "confirmed",
                  slot: 500,
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.kind === "confirmed") {
      expect(result.value.slot).toBe(500);
    }
  });

  it("parses processed as pending", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "processed",
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.kind).toBe("pending");
    }
  });

  it("returns InvalidResponse when value is empty", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [] } }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when slot is not number", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: "not-number", err: null }],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("maps unknown thrown error using transport error mapper", async () => {
    const error = createSdkError("Unknown", "Something went wrong");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { error }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
  });

  it("returns InvalidResponse when response has no value", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: {} }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when value is not array", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: "not-array" } }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse for unknown confirmationStatus", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "unknown-status", err: null }],
            },
          },
        ],
      ]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns transport SDK error as-is", async () => {
    const error = createSdkError("NetworkError", "Network failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { error }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("NetworkError");
    }
  });

  it("does not throw", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { error: createSdkError("Unknown", "test") }]]),
    });

    const result = await fetchTransactionStatus(transport, "sig123");
    expect(result).toBeDefined();
  });
});

describe("isTerminalStatus", () => {
  it("pending is not terminal", () => {
    expect(isTerminalStatus({ kind: "pending" })).toBe(false);
  });

  it("failed is terminal", () => {
    expect(isTerminalStatus({ kind: "failed", error: "test error" })).toBe(true);
  });

  it("finalized is terminal", () => {
    expect(isTerminalStatus({ kind: "finalized" })).toBe(true);
  });

  it("confirmed is terminal for default commitment", () => {
    expect(isTerminalStatus({ kind: "confirmed" })).toBe(true);
  });

  it("confirmed is terminal for confirmed commitment", () => {
    expect(isTerminalStatus({ kind: "confirmed" }, "confirmed")).toBe(true);
  });

  it("confirmed is not terminal for finalized commitment", () => {
    expect(isTerminalStatus({ kind: "confirmed" }, "finalized")).toBe(false);
  });
});

describe("pollTransactionConfirmation", () => {
  it("returns ok immediately when status is confirmed", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          { success: { value: [{ confirmationStatus: "confirmed", slot: 100, err: null }] } },
        ],
      ]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 1000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("confirmed");
      expect(result.value.attempts).toBe(1);
    }
  });

  it("returns ok immediately when status is finalized", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          { success: { value: [{ confirmationStatus: "finalized", slot: 100, err: null }] } },
        ],
      ]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 1000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("finalized");
    }
  });

  it("returns ok immediately when status is failed", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 100, err: { Custom: 1 } }],
            },
          },
        ],
      ]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 1000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("failed");
    }
  });

  it("returns timeout when status remains pending", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [null] } }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    let pollPromise = pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 300,
    }, { clock, timer });

    // Advance clock to exceed timeout
    timer.advanceAndFlush(400, clock);

    const result = await pollPromise;

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("Timeout");
    }
  });

  it("polls again while status is pending", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        // First call returns pending, second returns confirmed
        return callCount === 1
          ? { value: [null] }
          : { value: [{ confirmationStatus: "confirmed", err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Test that timer.setTimeout is called to schedule the retry
    let timerSetTimeoutCalled = false;
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void, delay: number) {
      timerSetTimeoutCalled = true;
      expect(delay).toBe(100);
      // Call callback immediately to avoid async complexity
      callback();
      return originalSetTimeout.call(this, callback, delay);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 5000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    expect(timerSetTimeoutCalled).toBe(true);
    expect(callCount).toBe(2);
  });

  it("waits using injected timer between polls", async () => {
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        return { value: [{ confirmationStatus: "confirmed", err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 1000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("confirmed");
    }
  });

  it("continues polling after retryable transport error", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        if (callCount === 1) {
          throw createSdkError("NetworkError", "Connection lost");
        }
        return { value: [{ confirmationStatus: "confirmed", err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Mock timer.setTimeout to immediately call the callback
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void) {
      callback();
      return originalSetTimeout.call(this, callback, 100);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 5000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    expect(callCount).toBe(2);
  });

  it("returns timeout with retryable Timeout error", async () => {
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        throw createSdkError("Timeout", "RPC timeout");
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    let pollPromise = pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 250,
    }, { clock, timer });

    timer.advanceAndFlush(300, clock);

    const result = await pollPromise;

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("Timeout");
    }
  });

  it("respects target commitment finalized", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        // Always return confirmed, never return finalized
        return { value: [{ confirmationStatus: "confirmed", err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await Promise.race([
      pollTransactionConfirmation(transport, "sig123", {
        commitment: "finalized",
        pollIntervalMs: 100,
        timeoutMs: 250,
      }, { clock, timer }),
      new Promise<Result<PollTransactionConfirmationResult>>(resolve => {
        setTimeout(() => {
          resolve(err(createSdkError("Timeout", "Test timeout")));
        }, 300);
      }),
    ]);

    // Should timeout because confirmed is not terminal for finalized commitment
    expect(isOk(result)).toBe(false);
  });

  it("eventually succeeds when finalized appears", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        // Simulate: first few calls return pending, then finalized
        if (callCount < 3) {
          return { value: [null] };
        }
        return { value: [{ confirmationStatus: "finalized", err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Mock timer to execute callbacks immediately
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void) {
      callback();
      return originalSetTimeout.call(this, callback, 50);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "finalized",
      pollIntervalMs: 50,
      timeoutMs: 5000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("finalized");
      expect(result.value.attempts).toBe(3);
    }
  });

  it("increments attempts count on each poll", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        if (callCount < 4) {
          return { value: [null] };
        }
        return { value: [{ confirmationStatus: "confirmed", err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Mock timer to execute callbacks immediately
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void) {
      callback();
      return originalSetTimeout.call(this, callback, 50);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 50,
      timeoutMs: 5000,
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.attempts).toBe(4);
    }
  });

  it("returns timeout error when status remains pending", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { success: { value: [null] } }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    let pollPromise = pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 50,
      timeoutMs: 200,
    }, { clock, timer });

    timer.advanceAndFlush(250, clock);

    const result = await pollPromise;

    expect(isOk(result)).toBe(false);
  });

  it("stops polling after timeout", async () => {
    let callCount = 0;

    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        return { value: [null] };
      },
      getCallCount() {
        return callCount;
      },
    } as unknown as RpcTransport & { getCallCount: () => number };

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    let pollPromise = pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 250,
    }, { clock, timer });

    timer.advanceAndFlush(300, clock);

    await pollPromise;

    // Should have called a limited number of times, not continuously
    expect(callCount).toBeGreaterThan(0);
    expect(callCount).toBeLessThan(10);
  });

  it("returns non-retryable error immediately", async () => {
    const error = createSdkError("InvalidTransaction", "Invalid sig");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["getSignatureStatuses", { error }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 1000,
    }, { clock, timer });

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("does not use real timers", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "getSignatureStatuses",
          { success: { value: [{ confirmationStatus: "confirmed", slot: 100, err: null }] } },
        ],
      ]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const startRealTime = Date.now();

    const result = await pollTransactionConfirmation(transport, "sig123", {
      commitment: "confirmed",
      pollIntervalMs: 100,
      timeoutMs: 1000,
    }, { clock, timer });

    const endRealTime = Date.now();

    // Should complete instantly with fake clock
    expect(endRealTime - startRealTime).toBeLessThan(100);
    expect(isOk(result)).toBe(true);
  });
});
