/**
 * Tests for timeout utilities.
 */

import { describe, it } from "vitest";
import { isWithinTimeout, createTimeoutError } from "../../src/rpc/timeout";

describe("isWithinTimeout", () => {
  it("returns true when timeoutMs is undefined", () => {
    // TODO: assert isWithinTimeout(0, 100) === true (no timeout specified)
  });

  it("returns false when elapsed exceeds timeout", () => {
    // TODO: assert isWithinTimeout(0, 150, 100) === false
  });

  it("returns true when elapsed is within timeout", () => {
    // TODO: assert isWithinTimeout(0, 50, 100) === true
  });

  it("returns true when elapsed equals timeout", () => {
    // TODO: assert isWithinTimeout(0, 100, 100) === true
  });
});

describe("createTimeoutError", () => {
  it("creates Timeout error with message", () => {
    // TODO: assert error.kind === "Timeout" and message includes method name
  });

  it("sets retryable=true", () => {
    // TODO: assert createTimeoutError(...).retryable === true
  });
});
