/**
 * Tests for circuit breaker logic.
 */

import { describe, it, expect } from "vitest";
import {
  shouldOpenCircuit,
  openCircuit,
  isCircuitOpen,
  maybeCloseCircuit,
} from "../../src/rpc/circuit-breaker.js";
import { createInitialEndpointState } from "../../src/rpc/endpoint.js";

describe("shouldOpenCircuit", () => {
  it("returns true when consecutive failures reach threshold", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 3,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(true);
  });

  it("returns false when failures below threshold", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 2,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(false);
  });

  it("returns true when failures exceed threshold", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      consecutiveFailures: 5,
    };
    const config = { failureThreshold: 3, openDurationMs: 30000 };
    expect(shouldOpenCircuit(state, config)).toBe(true);
  });
});

describe("openCircuit", () => {
  it("sets circuitOpenUntil to future time", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const updated = openCircuit(state, 100, 50);
    expect(updated.circuitOpenUntil).toBe(150);
  });

  it("preserves other state", () => {
    const state = { ...createInitialEndpointState({ url: "https://api.com" }), successCount: 5 };
    const updated = openCircuit(state, 100, 50);
    expect(updated.successCount).toBe(5);
  });
});

describe("isCircuitOpen", () => {
  it("returns true when circuitOpenUntil is in future", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 200,
    };
    expect(isCircuitOpen(state, 150)).toBe(true);
  });

  it("returns false when circuit not open", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    expect(isCircuitOpen(state, 150)).toBe(false);
  });

  it("returns false when circuitOpenUntil has passed", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
    };
    expect(isCircuitOpen(state, 150)).toBe(false);
  });

  it("returns false when circuitOpenUntil equals now", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
    };
    expect(isCircuitOpen(state, 100)).toBe(false);
  });
});

describe("maybeCloseCircuit", () => {
  it("closes circuit if expired", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 100,
      consecutiveFailures: 5,
    };
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.circuitOpenUntil).toBeUndefined();
    expect(updated.consecutiveFailures).toBe(0);
  });

  it("does nothing if circuit not yet expired", () => {
    const state = {
      ...createInitialEndpointState({ url: "https://api.com" }),
      circuitOpenUntil: 200,
      consecutiveFailures: 5,
    };
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.circuitOpenUntil).toBe(200);
    expect(updated.consecutiveFailures).toBe(5);
  });

  it("closes circuit that was never opened", () => {
    const state = createInitialEndpointState({ url: "https://api.com" });
    const updated = maybeCloseCircuit(state, 150);
    expect(updated.circuitOpenUntil).toBeUndefined();
    expect(updated.consecutiveFailures).toBe(0);
  });
});
