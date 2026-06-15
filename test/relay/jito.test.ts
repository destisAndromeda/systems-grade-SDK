/**
 * Tests for Jito relay client.
 */

import { describe, it, expect } from "vitest";
import { createJitoRelayClient } from "../../src/relay/jito.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";

const validBase64 = Buffer.from("tx").toString("base64");

describe("createJitoRelayClient", () => {
  it("creates a relay client named 'jito' by default", () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);

    expect(relay.name).toBe("jito");
  });

  it("supports custom relay name", () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport, { name: "custom-jito" });

    expect(relay.name).toBe("custom-jito");
  });

  it("calls sendTransaction by default", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    await relay.sendTransaction(validBase64);

    const calls = transport.getCalls();
    expect(calls.length).toBe(1);
    const firstCall = calls[0];
    if (firstCall) {
      expect(firstCall.method).toBe("sendTransaction");
    }
  });

  it("calls sendBundle when configured", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendBundle", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport, { method: "sendBundle" });
    await relay.sendTransaction(validBase64);

    const calls = transport.getCalls();
    expect(calls.length).toBe(1);
    const firstCall = calls[0];
    if (firstCall) {
      expect(firstCall.method).toBe("sendBundle");
    }
  });

  it("passes base64 transaction to transport", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    await relay.sendTransaction(validBase64);

    const calls = transport.getCalls();
    expect(calls.length).toBeGreaterThan(0);
    const firstCall = calls[0];
    if (firstCall && firstCall.params) {
      // For sendTransaction, params is [base64, {...}]
      const params = firstCall.params as unknown[];
      expect(Array.isArray(params)).toBe(true);
      if (Array.isArray(params)) {
        expect(params[0]).toBe(validBase64);
      }
    }
  });

  it("parses string signature response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "string-sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result.signature).toBe("string-sig");
  });

  it("parses { result: signature } response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: { result: "result-sig" } }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result.signature).toBe("result-sig");
  });

  it("parses { signature: signature } response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: { signature: "obj-sig" } }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result.signature).toBe("obj-sig");
  });

  it("throws InvalidResponse for empty signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "" }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
      if (isKindOfSdkError(error)) {
        expect(error.kind).toBe("InvalidResponse");
      }
    }
  });

  it("throws InvalidResponse for whitespace-only signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "   " }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
      if (isKindOfSdkError(error)) {
        expect(error.kind).toBe("InvalidResponse");
      }
    }
  });

  it("throws InvalidResponse for malformed response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: { invalidField: "value" } }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
      if (isKindOfSdkError(error)) {
        expect(error.kind).toBe("InvalidResponse");
      }
    }
  });

  it("throws transport SDK error as-is", async () => {
    const sdkError = createSdkError("NetworkError", "Transport failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { error: sdkError }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(error).toBe(sdkError);
    }
  });

  it("maps unknown thrown transport error", async () => {
    // We need a transport that throws an unknown error
    const throwingTransport = {
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      async send() {
        throw new Error("Unknown transport error");
      },
    };

    const relay = createJitoRelayClient(throwingTransport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
    }
  });

  it("does not throw - throws are for internal relay behavior", async () => {
    // This test documents that throws are internal to the relay client
    // Callers should expect throws, not Result errors
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result).toBeDefined();
    expect(result.signature).toBeDefined();
  });
});

// ─── getJitoTipFloor & selectJitoTipLamports ────────────────────────────────

import {
  getJitoTipFloor,
  selectJitoTipLamports,
  resetJitoTipFloorCacheForTests,
} from "../../src/relay/jito.js";
import type { JitoTipFloor } from "../../src/relay/jito.js";
import { beforeEach } from "vitest";

/** Build a fake fetch that resolves with the given body. */
function makeFakeFetch(body: unknown, ok = true): typeof fetch {
  return async (_url: string | URL | Request) => {
    return {
      ok,
      json: async () => body,
    } as Response;
  };
}

/** Build a fake fetch that rejects with an error. */
function makeThrowingFetch(): typeof fetch {
  return async (_url: string | URL | Request) => {
    throw new Error("Network error");
  };
}

const LIVE_FLOOR = [
  {
    percentile_25: 1_500,
    percentile_50: 3_000,
    percentile_75: 7_000,
    percentile_95: 15_000,
  },
];

const FALLBACK: JitoTipFloor = {
  p25: 1_000,
  p50: 2_000,
  p75: 5_000,
  p95: 10_000,
};

describe("getJitoTipFloor", () => {
  beforeEach(() => {
    resetJitoTipFloorCacheForTests();
  });

  it("fetches and parses Jito tip floor", async () => {
    const nowMs = 0;
    const floor = await getJitoTipFloor(makeFakeFetch(LIVE_FLOOR), () => nowMs);

    expect(floor.p25).toBe(1_500);
    expect(floor.p50).toBe(3_000);
    expect(floor.p75).toBe(7_000);
    expect(floor.p95).toBe(15_000);
  });

  it("caches tip floor for 60 seconds", async () => {
    let nowMs = 0;
    let fetchCallCount = 0;

    const countingFetch: typeof fetch = async (url) => {
      fetchCallCount++;
      return makeFakeFetch(LIVE_FLOOR)(url);
    };

    // First call — should fetch
    await getJitoTipFloor(countingFetch, () => nowMs);
    // Second call within 60 s — should use cache
    nowMs = 59_999;
    await getJitoTipFloor(countingFetch, () => nowMs);

    expect(fetchCallCount).toBe(1);
  });

  it("refreshes cache after 60 seconds", async () => {
    let nowMs = 0;
    let fetchCallCount = 0;

    const countingFetch: typeof fetch = async (url) => {
      fetchCallCount++;
      return makeFakeFetch(LIVE_FLOOR)(url);
    };

    // First call
    await getJitoTipFloor(countingFetch, () => nowMs);
    // Call after TTL expiry — should re-fetch
    nowMs = 60_001;
    await getJitoTipFloor(countingFetch, () => nowMs);

    expect(fetchCallCount).toBe(2);
  });

  it("returns fallback values when fetch fails", async () => {
    const floor = await getJitoTipFloor(makeThrowingFetch(), Date.now);

    expect(floor).toEqual(FALLBACK);
  });

  it("returns fallback values when response is not ok", async () => {
    const floor = await getJitoTipFloor(makeFakeFetch({}, false), Date.now);

    expect(floor).toEqual(FALLBACK);
  });

  it("returns fallback values when response is malformed", async () => {
    const floor = await getJitoTipFloor(
      makeFakeFetch([{ wrong_field: 999 }]),
      Date.now,
    );

    expect(floor).toEqual(FALLBACK);
  });

  it("parses flat object shape (p25/p50/p75/p95 keys)", async () => {
    const body = [{ p25: 500, p50: 1_000, p75: 2_000, p95: 4_000 }];
    const floor = await getJitoTipFloor(makeFakeFetch(body), Date.now);

    expect(floor.p25).toBe(500);
    expect(floor.p50).toBe(1_000);
    expect(floor.p75).toBe(2_000);
    expect(floor.p95).toBe(4_000);
  });
});

describe("selectJitoTipLamports", () => {
  const floor: JitoTipFloor = { p25: 1_000, p50: 2_000, p75: 5_000, p95: 10_000 };

  it("maps low aggressiveness to p25", () => {
    expect(selectJitoTipLamports(floor, "low")).toBe(1_000);
  });

  it("maps medium aggressiveness to p50", () => {
    expect(selectJitoTipLamports(floor, "medium")).toBe(2_000);
  });

  it("maps high aggressiveness to p75", () => {
    expect(selectJitoTipLamports(floor, "high")).toBe(5_000);
  });
});
