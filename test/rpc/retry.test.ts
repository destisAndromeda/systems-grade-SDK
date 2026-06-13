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

  it("retries Timeout", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("Timeout", "Timeout"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(true);
  });

  it("retries NetworkError", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("NetworkError", "Network failed"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(true);
  });

  it("retries RateLimited", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("RateLimited", "Rate limited"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(true);
  });

  it("does not retry InvalidConfig", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("InvalidConfig", "Invalid config"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });

  it("does not retry InvalidTransaction", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("InvalidTransaction", "Invalid transaction"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });

  it("does not retry InvalidResponse", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("InvalidResponse", "Invalid response"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });

  it("does not retry AllEndpointsFailed", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("AllEndpointsFailed", "All failed"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });

  it("respects explicit retryable: false", () => {
    const error = createSdkError("Timeout", "Timeout", { retryable: false });
    const result = {
      kind: "failure" as const,
      error,
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(false);
  });

  it("respects explicit retryable: true", () => {
    const error = createSdkError("InvalidConfig", "Invalid config", { retryable: true });
    const result = {
      kind: "failure" as const,
      error,
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(true);
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

  it("returns true before max attempts is reached", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("Timeout", "Timeout"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, retryConfig)).toBe(true);
    expect(shouldRetry(result, 2, retryConfig)).toBe(true);
  });

  it("handles attempt numbering consistently with config", () => {
    const result = {
      kind: "failure" as const,
      error: createSdkError("Timeout", "Timeout"),
      latencyMs: 100,
      endpointId: "test",
    };
    expect(shouldRetry(result, 1, { ...retryConfig, maxAttempts: 2 })).toBe(true);
    expect(shouldRetry(result, 2, { ...retryConfig, maxAttempts: 2 })).toBe(false);
  });
});

describe("computeBackoffMs", () => {
  const retryConfig = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, jitterRatio: 0.1 };

  it("returns base delay for first retry attempt", () => {
    const random = createFakeRandom(0.5); // Center of jitter range
    const delay = computeBackoffMs(1, retryConfig, random);
    expect(delay).toBeCloseTo(retryConfig.baseDelayMs, 1); // Should be close to base delay
  });

  it("grows exponentially on later attempts", () => {
    const random = createFakeRandom(0.5); // Center of jitter range
    const delay1 = computeBackoffMs(1, retryConfig, random);
    const delay2 = computeBackoffMs(2, retryConfig, random);
    const delay3 = computeBackoffMs(3, retryConfig, random);
    
    expect(delay1).toBeLessThan(delay2);
    expect(delay2).toBeLessThan(delay3);
  });

  it("respects multiplier", () => {
    const random = createFakeRandom(0.5);
    const baseDelay = computeBackoffMs(1, retryConfig, random);
    const nextDelay = computeBackoffMs(2, retryConfig, random);
    
    // With 2x multiplier (2^1 = 2), nextDelay should be roughly 2x baseDelay
    expect(nextDelay).toBeCloseTo(baseDelay * 2, 0);
  });

  it("caps at max delay", () => {
    const random = createFakeRandom(0.5);
    for (let i = 1; i <= 10; i++) {
      const delay = computeBackoffMs(i, retryConfig, random);
      expect(delay).toBeLessThanOrEqual(retryConfig.maxDelayMs);
    }
  });

  it("returns zero or base delay correctly when base delay is zero", () => {
    const random = createFakeRandom(0.5);
    const config = { ...retryConfig, baseDelayMs: 0 };
    const delay = computeBackoffMs(1, config, random);
    expect(delay).toBeGreaterThanOrEqual(0);
  });

  it("applies deterministic jitter using fake random", () => {
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

  it("returns same value when jitter is disabled", () => {
    const random = createFakeRandom(0.5);
    random.pushSequence([0.3, 0.7]); // Different random values
    
    const noJitterConfig = { ...retryConfig, jitterRatio: 0 };
    const delay1 = computeBackoffMs(1, noJitterConfig, random);
    const delay2 = computeBackoffMs(1, noJitterConfig, random);
    
    expect(delay1).toBe(delay2);
  });

  it("never returns negative delay", () => {
    const random = createFakeRandom();
    for (let i = 1; i <= 5; i++) {
      const delay = computeBackoffMs(i, retryConfig, random);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });

  it("never returns value greater than max delay", () => {
    const random = createFakeRandom();
    for (let i = 1; i <= 10; i++) {
      const delay = computeBackoffMs(i, retryConfig, random);
      expect(delay).toBeLessThanOrEqual(retryConfig.maxDelayMs);
    }
  });
});
