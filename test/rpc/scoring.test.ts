/**
 * Tests for endpoint scoring and selection.
 */

import { describe, it, expect } from "vitest";
import { scoreEndpoint, selectBestEndpoint, isEndpointCircuitOpen } from "../../src/rpc/scoring.js";
import { createInitialEndpointState } from "../../src/rpc/endpoint.js";
import { openCircuit } from "../../src/rpc/circuit-breaker.js";
import { isOk, isErr } from "../../src/core/result.js";

describe("scoreEndpoint", () => {
  const scoreConfig = { latencyWeight: 1, failureWeight: 1000, recentFailurePenalty: 100 };

  it("returns lower score for lower latency", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), avgLatencyMs: 50 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), avgLatencyMs: 100 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    expect(score1).toBeLessThan(score2);
  });

  it("returns lower score for fewer failures", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), successCount: 9, failureCount: 1 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), successCount: 5, failureCount: 5 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    expect(score1).toBeLessThan(score2);
  });

  it("handles zero-attempt endpoint without division errors", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const score = scoreEndpoint(state, scoreConfig, 1000);
    expect(isFinite(score)).toBe(true);
  });

  it("applies recent failure penalty", () => {
    const stateRecent = {
      ...createInitialEndpointState({ url: "https://api1.com" }),
      lastFailureAt: 1000,
    };
    const stateOld = {
      ...createInitialEndpointState({ url: "https://api2.com" }),
      lastFailureAt: 1,
    };
    const scoreRecent = scoreEndpoint(stateRecent, scoreConfig, 1050);
    const scoreOld = scoreEndpoint(stateOld, scoreConfig, 1050);
    expect(scoreRecent).toBeGreaterThan(scoreOld);
  });
});

describe("selectBestEndpoint", () => {
  const scoreConfig = { latencyWeight: 1, failureWeight: 1000, recentFailurePenalty: 100 };

  it("selects endpoint with lowest score", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), avgLatencyMs: 100 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), avgLatencyMs: 50 };
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1000);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe(state2.id);
    }
  });

  it("excludes circuit-open endpoints", () => {
    const state1 = createInitialEndpointState({ url: "https://api1.com" });
    const state2 = openCircuit(createInitialEndpointState({ url: "https://api2.com" }), 1000, 100);
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1050);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe(state1.id);
    }
  });

  it("returns error if all endpoints circuit-open", () => {
    const state1 = openCircuit(createInitialEndpointState({ url: "https://api1.com" }), 1000, 100);
    const state2 = openCircuit(createInitialEndpointState({ url: "https://api2.com" }), 1000, 100);
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1050);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("AllEndpointsFailed");
    }
  });
});
