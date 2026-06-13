/**
 * Tests for RPC endpoint utilities.
 */

import { describe, it, expect } from "vitest";
import { normalizeRpcEndpointConfig, createEndpointId, createInitialEndpointState, recordEndpointSuccess, recordEndpointFailure } from "../../src/rpc/endpoint.js";
import { createSdkError } from "../../src/core/error.js";
import { isOk, isErr } from "../../src/core/result.js";

describe("normalizeRpcEndpointConfig", () => {
  it("converts URL string to default config", () => {
    const result = normalizeRpcEndpointConfig("https://api.solana.com");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.url).toBe("https://api.solana.com");
      expect(result.value.weight).toBe(1);
    }
  });

  it("returns error for empty URL string", () => {
    const result = normalizeRpcEndpointConfig("");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("returns error for invalid URL", () => {
    const result = normalizeRpcEndpointConfig("not a url");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("preserves fields from object config", () => {
    const result = normalizeRpcEndpointConfig({ url: "https://api.solana.com", weight: 2 });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.url).toBe("https://api.solana.com");
      expect(result.value.weight).toBe(2);
    }
  });

  it("fills in default values", () => {
    const result = normalizeRpcEndpointConfig({ url: "https://api.solana.com" });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.weight).toBe(1);
    }
  });
});

describe("createEndpointId", () => {
  it("creates stable ID for same URL", () => {
    const config = { url: "https://api.solana.com" };
    const id1 = createEndpointId(config);
    const id2 = createEndpointId(config);
    expect(id1).toBe(id2);
  });

  it("normalizes trailing slashes", () => {
    const id1 = createEndpointId({ url: "https://api.solana.com" });
    const id2 = createEndpointId({ url: "https://api.solana.com/" });
    expect(id1).toBe(id2);
  });

  it("creates different IDs for different URLs", () => {
    const id1 = createEndpointId({ url: "https://api1.solana.com" });
    const id2 = createEndpointId({ url: "https://api2.solana.com" });
    expect(id1).not.toBe(id2);
  });

  it("case-normalizes URLs", () => {
    const id1 = createEndpointId({ url: "https://API.solana.com" });
    const id2 = createEndpointId({ url: "https://api.solana.com" });
    expect(id1).toBe(id2);
  });
});

describe("recordEndpointSuccess", () => {
  it("increments success count", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointSuccess(state, 100, 1000);
    expect(updated.successCount).toBe(1);
  });

  it("updates latency average", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointSuccess(state, 100, 1000);
    expect(updated.avgLatencyMs).toBe(100);
  });

  it("resets consecutive failures", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    let updated = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    expect(updated.consecutiveFailures).toBe(1);
    updated = recordEndpointSuccess(updated, 100, 1100);
    expect(updated.consecutiveFailures).toBe(0);
  });
});

describe("recordEndpointFailure", () => {
  it("increments failure count", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    expect(updated.failureCount).toBe(1);
    expect(updated.consecutiveFailures).toBe(1);
  });

  it("increments consecutive failures", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    state = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1100);
    expect(state.consecutiveFailures).toBe(2);
  });
});
