/**
 * Tests for timeout utilities.
 */

import { describe, it, expect } from "vitest";
import { isWithinTimeout, createTimeoutError } from "../../src/rpc/timeout.js";

describe("isWithinTimeout", () => {
  it("returns true when timeoutMs is undefined", () => {
    expect(isWithinTimeout(0, 100)).toBe(true);
  });

  it("returns false when elapsed exceeds timeout", () => {
    expect(isWithinTimeout(0, 150, 100)).toBe(false);
  });

  it("returns true when elapsed is within timeout", () => {
    expect(isWithinTimeout(0, 50, 100)).toBe(true);
  });

  it("returns true when elapsed equals timeout", () => {
    expect(isWithinTimeout(0, 100, 100)).toBe(true);
  });

  it("handles arbitrary start times", () => {
    expect(isWithinTimeout(1000, 1050, 100)).toBe(true);
    expect(isWithinTimeout(1000, 1150, 100)).toBe(false);
  });
});

describe("createTimeoutError", () => {
  it("creates Timeout error with message", () => {
    const error = createTimeoutError("getBlockHeight", 5000, 5000);
    expect(error.kind).toBe("Timeout");
    expect(error.message).toContain("getBlockHeight");
    expect(error.message).toContain("5000");
  });

  it("sets retryable=true", () => {
    const error = createTimeoutError("getBlockHeight", 1000, 5000);
    expect(error.retryable).toBe(true);
  });

  it("extends Error", () => {
    const error = createTimeoutError("getBlockHeight", 1000, 5000);
    expect(error instanceof Error).toBe(true);
  });
});
