/**
 * Tests for RPC endpoint utilities.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeRpcEndpointConfig,
  createEndpointId,
  createInitialEndpointState,
  recordEndpointSuccess,
  recordEndpointFailure,
  applyEndpointAttemptOutcome,
  isEndpointHealthy,
} from "../../src/rpc/endpoint.js";
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

  it("does not mutate object input", () => {
    const input = { url: "https://api.solana.com" };
    const inputCopy = JSON.parse(JSON.stringify(input));
    normalizeRpcEndpointConfig(input);
    expect(input).toEqual(inputCopy);
  });

  it("removes trailing slash from URL", () => {
    const result = normalizeRpcEndpointConfig("https://api.solana.com/");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.url).toBe("https://api.solana.com");
    }
  });

  it("keeps same normalized URL for URL with and without trailing slash", () => {
    const result1 = normalizeRpcEndpointConfig("https://api.solana.com");
    const result2 = normalizeRpcEndpointConfig("https://api.solana.com/");
    expect(isOk(result1) && isOk(result2)).toBe(true);
    if (isOk(result1) && isOk(result2)) {
      expect(result1.value.url).toBe(result2.value.url);
    }
  });

  it("accepts valid HTTP URL", () => {
    const result = normalizeRpcEndpointConfig("http://localhost:8899");
    expect(isOk(result)).toBe(true);
  });

  it("accepts valid HTTPS URL", () => {
    const result = normalizeRpcEndpointConfig("https://api.mainnet-beta.solana.com");
    expect(isOk(result)).toBe(true);
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

  it("ID is safe to use as object/map key", () => {
    const config = { url: "https://api.solana.com" };
    const id = createEndpointId(config);
    const map = new Map<string, string>();
    map.set(id, "test");
    expect(map.get(id)).toBe("test");
  });
});

describe("createInitialEndpointState", () => {
  it("initializes counters to zero", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    expect(state.successCount).toBe(0);
    expect(state.failureCount).toBe(0);
    expect(state.consecutiveFailures).toBe(0);
  });

  it("initializes avgLatencyMs to zero", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    expect(state.avgLatencyMs).toBe(0);
  });

  it("circuit is not open initially", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    expect(state.circuitOpenUntil).toBeUndefined();
  });

  it("state contains endpoint id and normalized config/url", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    expect(state.id).toBeDefined();
    expect(state.config).toBeDefined();
    expect(state.config.url).toBeDefined();
  });
});

describe("recordEndpointSuccess", () => {
  it("increments success count", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointSuccess(state, 100, 1000);
    expect(updated.successCount).toBe(1);
  });

  it("resets consecutive failures to zero", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    expect(state.consecutiveFailures).toBe(1);
    const updated = recordEndpointSuccess(state, 100, 1100);
    expect(updated.consecutiveFailures).toBe(0);
  });

  it("updates average latency after first success", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointSuccess(state, 100, 1000);
    expect(updated.avgLatencyMs).toBe(100);
  });

  it("updates average latency after multiple successes", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointSuccess(state, 100, 1000);
    state = recordEndpointSuccess(state, 200, 1100);
    expect(state.avgLatencyMs).toBe(150);
  });

  it("sets last success timestamp", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointSuccess(state, 100, 1000);
    expect(updated.lastSuccessAt).toBe(1000);
  });

  it("does not mutate previous state", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const stateCopy = JSON.parse(JSON.stringify(state));
    recordEndpointSuccess(state, 100, 1000);
    expect(state).toEqual(stateCopy);
  });

  it("preserves failureCount", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    const previousFailureCount = state.failureCount;
    const updated = recordEndpointSuccess(state, 100, 1100);
    expect(updated.failureCount).toBe(previousFailureCount);
  });
});

describe("recordEndpointFailure", () => {
  it("increments failureCount", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    expect(updated.failureCount).toBe(1);
    expect(updated.consecutiveFailures).toBe(1);
  });

  it("increments consecutiveFailures", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    state = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1100);
    expect(state.consecutiveFailures).toBe(2);
  });

  it("sets last failure timestamp", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const updated = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    expect(updated.lastFailureAt).toBe(1000);
  });

  it("preserves successCount", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointSuccess(state, 100, 1000);
    const previousSuccessCount = state.successCount;
    const updated = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1100);
    expect(updated.successCount).toBe(previousSuccessCount);
  });

  it("preserves avgLatencyMs", () => {
    let state = createInitialEndpointState({ url: "https://api.solana.com" });
    state = recordEndpointSuccess(state, 100, 1000);
    const previousAvgLatency = state.avgLatencyMs;
    const updated = recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1100);
    expect(updated.avgLatencyMs).toBe(previousAvgLatency);
  });

  it("does not mutate previous state", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const stateCopy = JSON.parse(JSON.stringify(state));
    recordEndpointFailure(state, createSdkError("NetworkError", "fail"), 1000);
    expect(state).toEqual(stateCopy);
  });
});

describe("applyEndpointAttemptOutcome", () => {
  it("applies success outcome using success path", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const outcome = {
      endpointId: state.id,
      success: true,
      latencyMs: 100,
    };
    const updated = applyEndpointAttemptOutcome(state, outcome, 1000);
    expect(updated.successCount).toBe(1);
    expect(updated.avgLatencyMs).toBe(100);
  });

  it("applies failure outcome using failure path", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const outcome = {
      endpointId: state.id,
      success: false,
      latencyMs: 100,
      error: createSdkError("NetworkError", "fail"),
    };
    const updated = applyEndpointAttemptOutcome(state, outcome, 1000);
    expect(updated.failureCount).toBe(1);
    expect(updated.consecutiveFailures).toBe(1);
  });

  it("preserves immutability", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    const stateCopy = JSON.parse(JSON.stringify(state));
    const outcome = {
      endpointId: state.id,
      success: true,
      latencyMs: 100,
    };
    applyEndpointAttemptOutcome(state, outcome, 1000);
    expect(state).toEqual(stateCopy);
  });
});

describe("isEndpointHealthy", () => {
  it("returns true for fresh initial endpoint", () => {
    const state = createInitialEndpointState({ url: "https://api.solana.com" });
    expect(isEndpointHealthy(state, 1000)).toBe(true);
  });

  it("returns false for circuit-open endpoint", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.solana.com" }),
      circuitOpenUntil: 2000,
    };
    expect(isEndpointHealthy(state, 1000)).toBe(false);
  });

  it("returns true again when circuit is closed/expired", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.solana.com" }),
      circuitOpenUntil: 1000,
    };
    expect(isEndpointHealthy(state, 1000)).toBe(true);
    expect(isEndpointHealthy(state, 2000)).toBe(true);
  });
});
