/**
 * Integration test: RPC fallback between endpoints.
 *
 * Verifies that the resilient client falls back to next endpoint
 * when the first one fails.
 */

import { describe, it, expect } from "vitest";
import { executeResilientRpcRequest } from "../../src/rpc/resilient-client.js";
import { createEndpointRegistry } from "../../src/rpc/registry.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { FakeRandom } from "../../src/testing/fake-random.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk } from "../../src/core/result.js";

describe("RPC Fallback", () => {
  it("falls back from failed endpoint to healthy endpoint", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Request timed out", { retryable: true });
    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { success: 5000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([
        ["https_api1_solana_com", transport1],
        ["https_api2_solana_com", transport2],
      ]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBe(5000);
      expect(result.value.endpointId).toBe("https_api2_solana_com");
    }

    // Verify first endpoint failure count increased
    const state1 = registryResult.value.getById("https_api1_solana_com");
    expect(state1?.failureCount).toBe(1);

    // Verify second endpoint success count increased
    const state2 = registryResult.value.getById("https_api2_solana_com");
    expect(state2?.successCount).toBe(1);
  });

  it("returns AllEndpointsFailed when all endpoints fail", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Request timed out", { retryable: true });
    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([
        ["https_api1_solana_com", transport1],
        ["https_api2_solana_com", transport2],
      ]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("AllEndpointsFailed");
    }
  });

  it("does not retry non-retryable endpoint error", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const responseError = createSdkError("InvalidResponse", "Invalid JSON response");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error: responseError }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }

    // Verify transport was called only once (no retries)
    expect(transport.callCount()).toBe(1);
  });
});
