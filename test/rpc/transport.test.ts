/**
 * Tests for RPC transport utilities.
 */

import { describe, it, expect } from "vitest";
import {
  createRpcRequestContext,
  mapTransportErrorToSdkError,
  executeRpcAttempt,
} from "../../src/rpc/transport.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";

describe("createRpcRequestContext", () => {
  it("creates context with method, params, startedAtMs", () => {
    const context = createRpcRequestContext("getBalance", { address: "test" }, 1000);

    expect(context.method).toBe("getBalance");
    expect(context.params).toEqual({ address: "test" });
    expect(context.startedAtMs).toBe(1000);
  });

  it("includes timeout when provided", () => {
    const context = createRpcRequestContext("getBalance", { address: "test" }, 1000, 5000);

    expect(context.timeoutMs).toBe(5000);
  });

  it("does not include timeoutMs when undefined", () => {
    const context = createRpcRequestContext("getBalance", { address: "test" }, 1000);

    expect(context.timeoutMs).toBeUndefined();
  });

  it("preserves params value", () => {
    const params = { address: "test", amount: 100 };
    const context = createRpcRequestContext("transfer", params, 1000);

    expect(context.params).toEqual(params);
  });
});

describe("mapTransportErrorToSdkError", () => {
  it("returns existing SdkError unchanged", () => {
    const error = createSdkError("Timeout", "Request timed out");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped).toBe(error);
  });

  it("maps timeout message to Timeout error", () => {
    const error = new Error("Operation timeout");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("Timeout");
    expect(mapped.message).toContain("timeout");
  });

  it("maps ETIMEDOUT to Timeout error", () => {
    const error = new Error("ETIMEDOUT: socket");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("Timeout");
  });

  it("maps AbortError name to Timeout error", () => {
    const error = new Error("Aborted");
    Object.defineProperty(error, "name", { value: "AbortError" });
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("Timeout");
  });

  it("maps status 429 to RateLimited error", () => {
    const error = Object.assign(new Error("Too many requests"), { status: 429 });
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("RateLimited");
  });

  it("maps statusCode 429 to RateLimited error", () => {
    const error = Object.assign(new Error("Too many requests"), { statusCode: 429 });
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("RateLimited");
  });

  it("maps code 429 to RateLimited error", () => {
    const error = Object.assign(new Error("Too many requests"), { code: 429 });
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("RateLimited");
  });

  it("maps rate limit message to RateLimited error", () => {
    const error = new Error("rate limit exceeded");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("RateLimited");
  });

  it("maps 429 message to RateLimited error", () => {
    const error = new Error("HTTP 429");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("RateLimited");
  });

  it("maps ECONNRESET to NetworkError", () => {
    const error = new Error("ECONNRESET: Connection reset by peer");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("NetworkError");
  });

  it("maps ECONNREFUSED to NetworkError", () => {
    const error = new Error("ECONNREFUSED: Connection refused");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("NetworkError");
  });

  it("maps ENOTFOUND to NetworkError", () => {
    const error = new Error("ENOTFOUND: Address not found");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("NetworkError");
  });

  it("maps fetch failed to NetworkError", () => {
    const error = new Error("fetch failed");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("NetworkError");
  });

  it("maps socket error to NetworkError", () => {
    const error = new Error("socket disconnected");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("NetworkError");
  });

  it("maps connection error to NetworkError", () => {
    const error = new Error("connection lost");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("NetworkError");
  });

  it("maps unknown error to Unknown error", () => {
    const error = new Error("Something went wrong");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.kind).toBe("Unknown");
  });

  it("handles string errors", () => {
    const mapped = mapTransportErrorToSdkError("Random string error");

    expect(mapped.kind).toBe("Unknown");
    expect(mapped.message).toContain("Random string error");
  });

  it("preserves original error as cause", () => {
    const error = new Error("Original error");
    const mapped = mapTransportErrorToSdkError(error);

    expect(mapped.cause).toBe(error);
  });
});

describe("executeRpcAttempt", () => {
  it("returns success result when transport succeeds", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now());

    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.value).toBe(1000);
      expect(result.endpointId).toBe("solana-rpc");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns failure result when transport throws", async () => {
    const error = createSdkError("NetworkError", "Connection failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { error }]]),
    });

    const clock = new FakeClock();
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now());

    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error.kind).toBe("NetworkError");
      expect(result.endpointId).toBe("solana-rpc");
    }
  });

  it("preserves endpoint id in result", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "custom-endpoint",
      responses: new Map([["getBalance", { success: 500 }]]),
    });

    const clock = new FakeClock();
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now());

    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.endpointId).toBe("custom-endpoint");
  });

  it("measures latency with fake clock", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const startMs = clock.now();
    clock.advance(50);

    const context = createRpcRequestContext("getBalance", { address: "test" }, startMs);
    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.latencyMs).toBe(50);
    }
  });

  it("returns zero latency when clock does not advance", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const startMs = clock.now();

    const context = createRpcRequestContext("getBalance", { address: "test" }, startMs);
    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.latencyMs).toBe(0);
    }
  });

  it("maps thrown unknown error to SDK error", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { error: new Error("Unknown error") }]]),
    });

    const clock = new FakeClock();
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now());

    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(isKindOfSdkError(result.error)).toBe(true);
    }
  });

  it("preserves thrown SDK error", async () => {
    const sdkError = createSdkError("Timeout", "Request timed out", { retryable: true });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { error: sdkError }]]),
    });

    const clock = new FakeClock();
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now());

    const result = await executeRpcAttempt(transport, context, clock);

    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error).toBe(sdkError);
    }
  });

  it("passes timeout option to transport", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now(), 5000);

    await executeRpcAttempt(transport, context, clock);

    const calls = transport.getCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]!.options?.timeoutMs).toBe(5000);
  });

  it("uses withTimeout when timer and timeout are provided", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const context = createRpcRequestContext("getBalance", { address: "test" }, clock.now(), 5000);

    const result = await executeRpcAttempt(transport, context, clock, timer);

    expect(result.kind).toBe("success");
  });

  it("returns failure with Timeout when timeout fires first", async () => {
    // Create a slow transport that takes longer than timeout
    let slowResolve: ((value: number) => void) | undefined;
    const slowPromise = new Promise<number>((resolve) => {
      slowResolve = resolve;
    });

    const transport: any = {
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      send: () => slowPromise,
    };

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const startMs = clock.now();
    const context = createRpcRequestContext("getBalance", { address: "test" }, startMs, 100);

    const resultPromise = executeRpcAttempt(transport, context, clock, timer);

    // Advance time past timeout
    clock.advance(150);
    await timer.flush();

    const result = await resultPromise;

    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.error.kind).toBe("Timeout");
    }

    // Clean up by resolving the slow promise
    slowResolve?.(1000);
  });
});
