/**
 * Tests for circuit breaker logic.
 */

import { describe, it } from "vitest";
import {
  shouldOpenCircuit,
  openCircuit,
  isCircuitOpen,
  maybeCloseCircuit,
} from "../../src/rpc/circuit-breaker.js";

describe("shouldOpenCircuit", () => {
  it("returns true when consecutive failures reach threshold", () => {
    // TODO: create endpoint with consecutiveFailures=3, config with failureThreshold=3,
    // assert shouldOpenCircuit returns true
  });

  it("returns false when failures below threshold", () => {
    // TODO: create endpoint with consecutiveFailures=2, threshold=3,
    // assert shouldOpenCircuit returns false
  });
});

describe("openCircuit", () => {
  it("sets circuitOpenUntil to future time", () => {
    // TODO: openCircuit(state, now=100, duration=50), assert circuitOpenUntil=150
  });
});

describe("isCircuitOpen", () => {
  it("returns true when circuitOpenUntil is in future", () => {
    // TODO: create endpoint with circuitOpenUntil=200, check at time=150,
    // assert isCircuitOpen returns true
  });

  it("returns false when circuit not open", () => {
    // TODO: create endpoint without circuitOpenUntil,
    // assert isCircuitOpen returns false
  });

  it("returns false when circuitOpenUntil has passed", () => {
    // TODO: create endpoint with circuitOpenUntil=100, check at time=150,
    // assert isCircuitOpen returns false
  });
});

describe("maybeCloseCircuit", () => {
  it("closes circuit if expired", () => {
    // TODO: create endpoint with circuitOpenUntil=100, check at time=150,
    // assert circuitOpenUntil cleared and consecutiveFailures reset to 0
  });

  it("does nothing if circuit not yet expired", () => {
    // TODO: create endpoint with circuitOpenUntil=200, check at time=150,
    // assert circuitOpenUntil unchanged
  });
});
