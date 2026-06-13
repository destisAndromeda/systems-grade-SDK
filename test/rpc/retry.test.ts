/**
 * Tests for retry logic and backoff computation.
 */

import { describe, it } from "vitest";
import { shouldRetry, computeBackoffMs } from "../../src/rpc/retry.js";

describe("shouldRetry", () => {
  it("returns false for successful result", () => {
    // TODO: create success result, assert shouldRetry returns false
  });

  it("returns false when max attempts reached", () => {
    // TODO: create failure result at attemptNumber=3 with maxAttempts=3, assert false
  });

  it("returns true for retryable error within attempt budget", () => {
    // TODO: create Timeout error, attempt 1 of 3, assert true
  });

  it("returns false for non-retryable error", () => {
    // TODO: create InvalidConfig error, assert false regardless of attempt count
  });
});

describe("computeBackoffMs", () => {
  it("computes exponential backoff (2^(attempt-1))", () => {
    // TODO: assert computeBackoffMs(1, config, ...) ≈ baseDelayMs
    // assert computeBackoffMs(2, config, ...) ≈ baseDelayMs * 2
    // assert computeBackoffMs(3, config, ...) ≈ baseDelayMs * 4
  });

  it("caps delay at maxDelayMs", () => {
    // TODO: assert computeBackoffMs(10, config, ...) <= maxDelayMs
  });

  it("applies jitter within ratio bounds", () => {
    // TODO: use fake random, computeBackoffMs with jitterRatio=0.1,
    // assert result is within ±10% of base value
  });

  it("never returns negative delay", () => {
    // TODO: call with various values, assert always >= 0
  });
});
