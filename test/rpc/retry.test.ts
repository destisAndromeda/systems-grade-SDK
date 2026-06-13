/**
 * Tests for retry logic and backoff computation.
 */

import { describe, it, expect } from "vitest";
import { shouldRetry, computeBackoffMs } from "../../src/rpc/retry.js";
import { createSdkError } from "../../src/core/error.js";
import { createFakeRandom } from "../../src/testing/fake-random.js";

describe("shouldRetry", () => {
  const retryConfig = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, jitterRatio: 0.1 };

  it("returns false for successful result", () => {
    const result = { kind: "success" as const, value: "ok", latencyMs: 100, endpointId: "test" };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });

  it("returns false when max attempts reached", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("Timeout", "Timeout"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 3, retryConfig)).toBe(false);
  });

  it("returns true for retryable error within attempt budget", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("Timeout", "Timeout"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(true);
  });

  it("returns false for non-retryable error", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("InvalidConfig", "Invalid config"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });
});

describe("computeBackoffMs", () => {
  const retryConfig = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, jitterRatio: 0.1 };

  it("computes exponential backoff (2^(attempt-1))", () => {
    const random = createFakeRandom(0.5); // Center of jitter range
    const delay1 = computeBackoffMs(1, retryConfig, random);
    const delay2 = computeBackoffMs(2, retryConfig, random);
    const delay3 = computeBackoffMs(3, retryConfig, random);
    
    expect(delay1).toBeLessThan(delay2);
    expect(delay2).toBeLessThan(delay3);
  });

  it("caps delay at maxDelayMs", () => {
    const random = createFakeRandom(0.5);
    for (let i = 1; i <= 10; i++) {
      const delay = computeBackoffMs(i, retryConfig, random);
      expect(delay).toBeLessThanOrEqual(retryConfig.maxDelayMs);
    }
  });

  it("applies jitter within ratio bounds", () => {
    const random = createFakeRandom();
    random.pushSequence([0.0, 0.5, 1.0]); // Extreme jitter values
    
    const baseConfig = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, jitterRatio: 0.2 };
    const delay1 = computeBackoffMs(1, baseConfig, random);
    const delay2 = computeBackoffMs(1, baseConfig, random);
    const delay3 = computeBackoffMs(1, baseConfig, random);
    
    // All should be within baseDelay ± (baseDelay * jitterRatio)
    const baseDelay = baseConfig.baseDelayMs;
    const bound = baseDelay * baseConfig.jitterRatio;
    expect(delay1).toBeGreaterThanOrEqual(baseDelay - bound);
    expect(delay1).toBeLessThanOrEqual(baseDelay + bound);
    expect(delay3).toBeGreaterThanOrEqual(baseDelay - bound);
    expect(delay3).toBeLessThanOrEqual(baseDelay + bound);
  });

  it("never returns negative delay", () => {
    const random = createFakeRandom();
    for (let i = 1; i <= 5; i++) {
      const delay = computeBackoffMs(i, retryConfig, random);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });
});
