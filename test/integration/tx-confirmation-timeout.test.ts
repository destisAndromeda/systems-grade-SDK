/**
 * Integration test: Transaction confirmation with timeout.
 *
 * Verifies that confirmation polling returns confirmed before timeout,
 * or times out if status never becomes final.
 */

import { describe, it, expect } from "vitest";
import { pollTransactionConfirmation } from "../../src/tx/confirm.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk } from "../../src/core/result.js";
import type { RpcTransport } from "../../src/rpc/types.js";

function createSequentialStatusTransport(
  responses: Array<{ value?: unknown } | Error | any>,
): RpcTransport & { callCount: () => number } {
  let calls = 0;

  return {
    endpointUrl: "https://rpc.test",
    endpointId: "rpc-test",
    async send() {
      const response = responses[calls];
      calls++;

      if (response instanceof Error || isKindOfSdkError(response)) {
        throw response;
      }

      return response as unknown;
    },
    callCount() {
      return calls;
    },
  } as RpcTransport & { callCount: () => number };
}

describe("Transaction Confirmation Timeout", () => {
  it("confirms before timeout", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        if (callCount < 3) {
          return { value: [null] };
        }
        return { value: [{ confirmationStatus: "confirmed", slot: 100, err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Mock timer to execute callbacks immediately
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void) {
      callback();
      return originalSetTimeout.call(this, callback, 100);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      pollIntervalMs: 100,
      timeoutMs: 5000,
      commitment: "confirmed",
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("confirmed");
      expect(result.value.attempts).toBe(3);
    }
  });

  it("finalizes before timeout when finalized commitment is requested", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        if (callCount === 1) {
          return { value: [{ confirmationStatus: "confirmed", slot: 100, err: null }] };
        }
        return { value: [{ confirmationStatus: "finalized", slot: 101, err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Mock timer to execute callbacks immediately
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void) {
      callback();
      return originalSetTimeout.call(this, callback, 100);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      pollIntervalMs: 100,
      timeoutMs: 5000,
      commitment: "finalized",
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("finalized");
    }
  });

  it("continues after retryable status fetch error", async () => {
    let callCount = 0;
    const transport = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        callCount++;
        if (callCount === 1) {
          throw createSdkError("NetworkError", "Connection lost");
        }
        if (callCount === 2) {
          return { value: [null] };
        }
        return { value: [{ confirmationStatus: "confirmed", slot: 100, err: null }] };
      },
    } as unknown as RpcTransport;

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    // Mock timer to execute callbacks immediately
    const originalSetTimeout = timer.setTimeout;
    timer.setTimeout = function (callback: () => void) {
      callback();
      return originalSetTimeout.call(this, callback, 100);
    };

    const result = await pollTransactionConfirmation(transport, "sig123", {
      pollIntervalMs: 100,
      timeoutMs: 5000,
      commitment: "confirmed",
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.attempts).toBe(3);
    }
  });

  it("times out when transaction remains pending", async () => {
    const transport = createSequentialStatusTransport([
      { value: [null] },
      { value: [null] },
      { value: [null] },
      { value: [null] },
    ]);

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const pollPromise = pollTransactionConfirmation(transport, "sig123", {
      pollIntervalMs: 100,
      timeoutMs: 300,
      commitment: "confirmed",
    }, { clock, timer });

    // Advance clock to exceed timeout
    timer.advanceAndFlush(400, clock);

    const result = await pollPromise;

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("Timeout");
    }
  });



  it("fails fast on transaction failure status", async () => {
    const transport = createSequentialStatusTransport([
      { value: [{ confirmationStatus: "confirmed", slot: 100, err: { Custom: 1 } }] },
    ]);

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      pollIntervalMs: 100,
      timeoutMs: 5000,
      commitment: "confirmed",
    }, { clock, timer });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status.kind).toBe("failed");
      expect(result.value.attempts).toBe(1);
    }
  });

  it("stops on non-retryable status fetch error", async () => {
    const transport = createSequentialStatusTransport([
      createSdkError("InvalidResponse", "Malformed response"),
    ]);

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);

    const result = await pollTransactionConfirmation(transport, "sig123", {
      pollIntervalMs: 100,
      timeoutMs: 5000,
      commitment: "confirmed",
    }, { clock, timer });

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }

    expect(transport.callCount()).toBe(1);
  });
});
