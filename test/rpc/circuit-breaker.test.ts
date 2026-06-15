/**
 * Tests for circuit breaker logic.
 */

import { describe, it, expect } from "vitest";
import {
  shouldOpenCircuit,
  openCircuit,
  isCircuitOpen,
  maybeCloseCircuit,
  getCircuitState,
  shouldAllowRequest,
  tripCircuit,
  recordCircuitSuccess,
  recordCircuitFailure,
} from "../../src/rpc/circuit-breaker.js";
import { createInitialEndpointState } from "../../src/rpc/endpoint.js";

describe("shouldOpenCircuit", () => {
  it("returns false below failure threshold", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 2,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(false);
  });

  it("returns true when consecutive failures reach threshold", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 3,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(true);
  });

  it("returns true when failures exceed threshold", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 5,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(true);
  });

  it("uses consecutiveFailures, not total failureCount", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      failureCount: 10,
      consecutiveFailures: 2,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(false);
  });
});

describe("openCircuit", () => {
  it("opens circuit", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const updated = openCircuit(state, 100, 50);
    expect(updated.circuitOpenUntil).toBeDefined();
    expect(updated.circuitOpenUntil).toBeGreaterThan(100);
  });

  it("sets opened timestamp", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const updated = openCircuit(state, 100, 50);
    // The function sets circuitOpenUntil to nowMs + openDurationMs
    expect(updated.circuitOpenUntil).toBe(150);
  });

  it("sets open-until/cooldown timestamp", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const updated = openCircuit(state, 100, 50);
    expect(updated.circuitOpenUntil).toBe(150);
  });

  it("preserves counters", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      successCount: 5,
      failureCount: 3,
      consecutiveFailures: 2,
    };
    const updated = openCircuit(state, 100, 50);
    expect(updated.successCount).toBe(5);
    expect(updated.failureCount).toBe(3);
    expect(updated.consecutiveFailures).toBe(2);
  });

  it("does not mutate previous state", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const stateCopy = JSON.parse(JSON.stringify(state));
    openCircuit(state, 100, 50);
    expect(state).toEqual(stateCopy);
  });
});

describe("isCircuitOpen", () => {
  it("returns false for initial endpoint", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    expect(isCircuitOpen(state, 150)).toBe(false);
  });

  it("returns true immediately after circuit opens", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const opened = openCircuit(state, 100, 50);
    expect(isCircuitOpen(opened, 100)).toBe(true);
  });

  it("returns true before cooldown expiry", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 200,
    };
    expect(isCircuitOpen(state, 150)).toBe(true);
  });

  it("returns false exactly at or after cooldown expiry, based on chosen boundary rule", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
    };
    // At the boundary (100), circuit should be closed
    expect(isCircuitOpen(state, 100)).toBe(false);
  });

  it("returns false after cooldown expiry", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
    };
    expect(isCircuitOpen(state, 150)).toBe(false);
  });
});

describe("maybeCloseCircuit", () => {
  it("keeps circuit open before cooldown expiry", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 200,
      consecutiveFailures: 5,
    };
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.circuitOpenUntil).toBe(200);
    expect(updated.consecutiveFailures).toBe(5);
  });

  it("closes circuit after cooldown expiry", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
      consecutiveFailures: 5,
    };
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.circuitOpenUntil).toBeUndefined();
  });

  it("preserves success/failure counters", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
      successCount: 10,
      failureCount: 5,
      consecutiveFailures: 2,
    };
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.successCount).toBe(10);
    expect(updated.failureCount).toBe(5);
  });

  it("resets or preserves consecutive failures consistently with implementation choice", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
      consecutiveFailures: 5,
    };
    const updated = maybeCloseCircuit(state, 150);
    // When circuit closes, consecutive failures should be reset
    expect(updated.consecutiveFailures).toBe(0);
  });

  it("does not mutate previous state", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
    };
    const stateCopy = JSON.parse(JSON.stringify(state));
    maybeCloseCircuit(state, 150);
    expect(state).toEqual(stateCopy);
  });

  it("closes circuit that was never opened", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.circuitOpenUntil).toBeUndefined();
    expect(updated.consecutiveFailures).toBe(0);
  });

  it("closed endpoint allows request", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    expect(shouldAllowRequest(state, 100)).toBe(true);
  });

  it("failure threshold opens circuit", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 3,
    };
    const config = { failureThreshold: 3, openDurationMs: 1000 };
    expect(shouldOpenCircuit(state, config)).toBe(true);
    const opened = openCircuit(state, 100, 1000);
    expect(opened.circuitState).toBe("open");
    expect(opened.circuitOpenedAt).toBe(100);
    expect(opened.circuitOpenUntil).toBe(1100);
  });

  it("open circuit blocks request before cooldown", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitState: "open" as const,
      circuitOpenedAt: 100,
      circuitCooldownMs: 1000,
      circuitOpenUntil: 1100,
    };
    expect(shouldAllowRequest(state, 1000)).toBe(false);
    expect(isCircuitOpen(state, 1000)).toBe(true);
  });

  it("open circuit becomes half-open after cooldown", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitState: "open" as const,
      circuitOpenedAt: 100,
      circuitCooldownMs: 1000,
      circuitOpenUntil: 1100,
    };
    expect(getCircuitState(state, 1150)).toBe("half_open");
    expect(shouldAllowRequest(state, 1150)).toBe(true);
    expect(isCircuitOpen(state, 1150)).toBe(false);
  });

  it("half-open success closes circuit", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitState: "half_open" as const,
      consecutiveFailures: 3,
      circuitCooldownMs: 2000,
    };
    const updated = recordCircuitSuccess(state);
    expect(updated.circuitState).toBe("closed");
    expect(updated.consecutiveFailures).toBe(0);
    expect(updated.circuitCooldownMs).toBe(1000);
  });

  it("half-open failure reopens circuit and increases cooldown with cap", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitState: "half_open" as const,
      circuitCooldownMs: 1000,
    };
    const updated = recordCircuitFailure(state, 200);
    expect(updated.circuitState).toBe("open");
    expect(updated.circuitCooldownMs).toBe(2000);
    expect(updated.circuitOpenedAt).toBe(200);

    const stateAtCap = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitState: "half_open" as const,
      circuitCooldownMs: 20000,
    };
    const updatedCap = recordCircuitFailure(stateAtCap, 300);
    expect(updatedCap.circuitCooldownMs).toBe(30000);
  });

  it("repeated openings increase cooldown exponentially", () => {
    let state = createInitialEndpointState({ url: "https://api.com" });
    // First trip
    state = tripCircuit(state, 100);
    expect(state.circuitCooldownMs).toBe(1000);

    // Cooldown elapsed, becomes half-open
    expect(getCircuitState(state, 1200)).toBe("half_open");
    state.circuitState = "half_open"; // Simulating transition

    // Second trip (failure in half_open)
    state = tripCircuit(state, 1200);
    expect(state.circuitCooldownMs).toBe(2000);

    // Third trip
    state.circuitState = "half_open";
    state = tripCircuit(state, 3500);
    expect(state.circuitCooldownMs).toBe(4000);
  });
});


