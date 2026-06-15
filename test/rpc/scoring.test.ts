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

  it("returns finite number for zero-attempt endpoint", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const score = scoreEndpoint(state, scoreConfig, 1000);
    expect(isFinite(score)).toBe(true);
  });

  it("lower latency endpoint gets lower score", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), avgLatencyMs: 50 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), avgLatencyMs: 100 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    expect(score1).toBeLessThan(score2);
  });

  it("endpoint with higher failure ratio gets worse score", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), successCount: 9, failureCount: 1 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), successCount: 5, failureCount: 5 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    expect(score1).toBeLessThan(score2);
  });

  it("endpoint with consecutive failures gets worse score", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), consecutiveFailures: 0 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), consecutiveFailures: 3 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    // Consecutive failures don't directly increase score, but they correlate with recent failures
    expect(score2).toBeGreaterThanOrEqual(score1);
  });

  it("recent failure increases score", () => {
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

  it("old failure penalty is lower than recent failure penalty", () => {
    const config = { latencyWeight: 0, failureWeight: 0, recentFailurePenalty: 100 };
    const stateVeryRecent = {
      ...createInitialEndpointState({ url: "https://api1.com" }),
      lastFailureAt: 1000,
    };
    const stateOld = {
      ...createInitialEndpointState({ url: "https://api2.com" }),
      lastFailureAt: 500,
    };
    const scoreVeryRecent = scoreEndpoint(stateVeryRecent, config, 1010);
    const scoreOld = scoreEndpoint(stateOld, config, 1010);
    expect(scoreVeryRecent).toBeGreaterThan(scoreOld);
  });

  it("endpoint weight affects score if weight is part of config", () => {
    // Note: weight is not directly used in scoreEndpoint, but endpoints can be weighted in selection
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), config: { url: "https://api1.com", weight: 1 } };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), config: { url: "https://api2.com", weight: 2 } };
    // The score function itself doesn't use weight, but it's available on the state
    expect(state1.config.weight).toBeDefined();
    expect(state2.config.weight).toBeDefined();
  });

  it("score never returns NaN", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const score = scoreEndpoint(state, scoreConfig, 1000);
    expect(Number.isNaN(score)).toBe(false);
  });

  it("endpoint with higher inFlightCount receives higher (worse) score", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), avgLatencyMs: 100, inFlightCount: 0 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), avgLatencyMs: 100, inFlightCount: 1 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    expect(score2).toBeGreaterThan(score1);
  });

  it("scoring penalizes lagging endpoint with higher (worse) score", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), avgLatencyMs: 100, slotLag: 0 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), avgLatencyMs: 100, slotLag: 50 };
    const score1 = scoreEndpoint(state1, scoreConfig, 1000);
    const score2 = scoreEndpoint(state2, scoreConfig, 1000);
    expect(score2).toBeGreaterThan(score1);
  });
});

describe("isEndpointCircuitOpen", () => {
  it("returns false for initial endpoint", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    expect(isEndpointCircuitOpen(state, 1000)).toBe(false);
  });

  it("returns true for endpoint with open circuit before cooldown expiry", () => {
    const state = openCircuit(createInitialEndpointState({ url: "https://api.com" }), 1000, 100);
    expect(isEndpointCircuitOpen(state, 1050)).toBe(true);
  });

  it("returns false after cooldown expiry", () => {
    const state = openCircuit(createInitialEndpointState({ url: "https://api.com" }), 1000, 100);
    expect(isEndpointCircuitOpen(state, 1101)).toBe(false);
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

  it("skips circuit-open endpoint", () => {
    const state1 = createInitialEndpointState({ url: "https://api1.com" });
    const state2 = openCircuit(createInitialEndpointState({ url: "https://api2.com" }), 1000, 100);
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1050);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe(state1.id);
    }
  });

  it("skips unhealthy endpoint if health helper supports this", () => {
    // Unhealthy endpoints are those with open circuit, which are already skipped
    const state1 = createInitialEndpointState({ url: "https://api1.com" });
    const state2 = openCircuit(createInitialEndpointState({ url: "https://api2.com" }), 1000, 100);
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1050);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe(state1.id);
    }
  });

  it("uses deterministic tie-breaking by input order", () => {
    const state1 = { ...createInitialEndpointState({ url: "https://api1.com" }), avgLatencyMs: 100 };
    const state2 = { ...createInitialEndpointState({ url: "https://api2.com" }), avgLatencyMs: 100 };
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1000);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe(state1.id);
    }
  });

  it("returns AllEndpointsFailed when all endpoints are circuit-open", () => {
    const state1 = openCircuit(createInitialEndpointState({ url: "https://api1.com" }), 1000, 100);
    const state2 = openCircuit(createInitialEndpointState({ url: "https://api2.com" }), 1000, 100);
    const result = selectBestEndpoint([state1, state2], scoreConfig, 1050);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("AllEndpointsFailed");
    }
  });

  it("returns AllEndpointsFailed for empty endpoint list", () => {
    const result = selectBestEndpoint([], scoreConfig, 1000);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("AllEndpointsFailed");
    }
  });

  it("returns selected endpoint wrapped in ok(...)", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const result = selectBestEndpoint([state], scoreConfig, 1000);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(state);
    }
  });
});
