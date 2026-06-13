/**
 * Integration test: Rate limiting and circuit breaker.
 *
 * Verifies that the circuit breaker opens when rate limit errors
 * occur repeatedly, and that it prevents further calls.
 */

import { describe, it, expect } from "vitest";
import { executeResilientRpcRequest } from "../../src/rpc/resilient-client.js";
import { createEndpointRegistry } from "../../src/rpc/registry.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { FakeRandom } from "../../src/testing/fake-random.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createSdkError } from "../../src/core/error.js";
import { isOk } from "../../src/core/result.js";

describe("Rate Limit Circuit Breaker", () => {
  it("opens circuit after repeated rate limit failures", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const rateLimitError = createSdkError("RateLimited", "Rate limited", { retryable: true });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error: rateLimitError }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    // Execute requests to trigger circuit breaker
    await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 5, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 2, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    const state = registryResult.value.getById("https_api_solana_com");
    expect(state?.circuitOpenUntil).toBeDefined();
    expect(state!.circuitOpenUntil!).toBeGreaterThan(clock.now());
  });

  it("skips circuit-open endpoint and uses another endpoint", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { success: 2000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    // Manually open first endpoint circuit
    const state1 = registryResult.value.getById("https_api1_solana_com");
    if (state1) {
      registryResult.value.upsert({
        ...state1,
        circuitOpenUntil: clock.now() + 10000,
      });
    }

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
      expect(result.value.endpointId).toBe("https_api2_solana_com");
    }

    // Verify first endpoint was never called
    expect(transport1.callCount()).toBe(0);
    // Verify second endpoint was called
    expect(transport2.callCount()).toBeGreaterThan(0);
  });

  it("reuses endpoint after circuit cooldown expires", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    // Manually open circuit
    const state = registryResult.value.getById("https_api_solana_com");
    if (state) {
      registryResult.value.upsert({
        ...state,
        circuitOpenUntil: clock.now() + 100,
      });
    }

    // Verify circuit is open
    let currentState = registryResult.value.getById("https_api_solana_com");
    expect(currentState?.circuitOpenUntil).toBeDefined();

    // Advance time past circuit expiry
    clock.advance(150);

    // Execute request
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

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBe(1000);
    }

    // Verify circuit was closed (no longer in open state)
    currentState = registryResult.value.getById("https_api_solana_com");
    expect(currentState?.circuitOpenUntil).toBeUndefined();
  });
});
