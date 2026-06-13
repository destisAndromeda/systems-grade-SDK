/**
 * Phase 0 smoke tests for public API.
 *
 * Verifies that the root index imports without errors and exports core symbols.
 * This prevents regressions in the public API surface.
 */

import { describe, it, expect } from "vitest";

describe("public index exports", () => {
  it("imports the root index without throwing", async () => {
    const sdk = await import("../src/index.js");
    expect(sdk).toBeDefined();
  });

  it("exports core Result type and functions", async () => {
    const { ok, err, isOk, isErr } = await import("../src/index.js");
    expect(typeof ok).toBe("function");
    expect(typeof err).toBe("function");
    expect(typeof isOk).toBe("function");
    expect(typeof isErr).toBe("function");
  });

  it("exports error utilities", async () => {
    const { createSdkError, isRetryableSdkError, mapToSdkError } = await import("../src/index.js");
    expect(typeof createSdkError).toBe("function");
    expect(typeof isRetryableSdkError).toBe("function");
    expect(typeof mapToSdkError).toBe("function");
  });

  it("exports RPC utilities", async () => {
    const {
      normalizeRpcEndpointConfig,
      createEndpointRegistry,
      scoreEndpoint,
      shouldRetry,
      isWithinTimeout,
    } = await import("../src/index.js");
    expect(typeof normalizeRpcEndpointConfig).toBe("function");
    expect(typeof createEndpointRegistry).toBe("function");
    expect(typeof scoreEndpoint).toBe("function");
    expect(typeof shouldRetry).toBe("function");
    expect(typeof isWithinTimeout).toBe("function");
  });

  it("exports transaction utilities", async () => {
    const { buildPreparedTransaction, isBlockhashExpired, pollTransactionConfirmation } =
      await import("../src/index.js");
    expect(typeof buildPreparedTransaction).toBe("function");
    expect(typeof isBlockhashExpired).toBe("function");
    expect(typeof pollTransactionConfirmation).toBe("function");
  });

  it("exports testing utilities", async () => {
    const { createFakeClock, createFakeTimer, createFakeRandom, createFakeRpcTransport } =
      await import("../src/index.js");
    expect(typeof createFakeClock).toBe("function");
    expect(typeof createFakeTimer).toBe("function");
    expect(typeof createFakeRandom).toBe("function");
    expect(typeof createFakeRpcTransport).toBe("function");
  });
});

describe("core result smoke test", () => {
  it("creates ok and err results", async () => {
    const { ok, err, isOk, isErr } = await import("../src/index.js");

    const success = ok(123);
    const failure = err(new Error("test"));

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
  });

  it("uses type guards correctly", async () => {
    const { ok, err, isOk, isErr } = await import("../src/index.js");

    const result = ok(42);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    } else {
      throw new Error("Expected ok result");
    }

    const errorResult = err(new Error("failed"));
    if (isErr(errorResult)) {
      expect(errorResult.error.message).toBe("failed");
    } else {
      throw new Error("Expected err result");
    }
  });
});

describe("endpoint config smoke test", () => {
  it("normalizes RPC endpoint URLs", async () => {
    const { normalizeRpcEndpointConfig, isOk } = await import("../src/index.js");

    const result = normalizeRpcEndpointConfig("https://api.solana.com");
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.url).toBe("https://api.solana.com");
      expect(result.value.weight).toBe(1);
    }
  });

  it("rejects invalid URLs", async () => {
    const { normalizeRpcEndpointConfig, isErr } = await import("../src/index.js");

    const result = normalizeRpcEndpointConfig("not-a-url");
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });
});
