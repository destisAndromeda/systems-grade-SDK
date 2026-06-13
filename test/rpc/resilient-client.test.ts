/**
 * Tests for resilient RPC client.
 */

import { describe, it, expect } from "vitest";
import { createResilientRpcClient, executeResilientRpcRequest } from "../../src/rpc/resilient-client.js";
import { createEndpointRegistry } from "../../src/rpc/registry.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { FakeRandom } from "../../src/testing/fake-random.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk } from "../../src/core/result.js";

describe("executeResilientRpcRequest", () => {
  it("returns ok on first successful attempt", async () => {
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
      expect(result.value.attempts).toBe(1);
    }
  });

  it("returns value from successful transport", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { success: 5000 }]]),
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

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBe(5000);
    }
  });

  it("includes endpointId in result", async () => {
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
      expect(result.value.endpointId).toBe("https_api_solana_com");
    }
  });

  it("includes attempts count in result", async () => {
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
      expect(result.value.attempts).toBe(1);
    }
  });

  it("records endpoint success in registry", async () => {
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

    await executeResilientRpcRequest(
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

    const state = registryResult.value.getById("https_api_solana_com");
    expect(state?.successCount).toBe(1);
  });

  it("records endpoint failure in registry", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const error = createSdkError("NetworkError", "Connection failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    await executeResilientRpcRequest(
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

    const state = registryResult.value.getById("https_api_solana_com");
    expect(state?.failureCount).toBe(1);
  });

  it("retries retryable Timeout", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
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
      expect(result.value.attempts).toBeGreaterThan(1);
    }
  });

  it("retries retryable NetworkError", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const networkError = createSdkError("NetworkError", "Connection failed", { retryable: true });
    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { error: networkError }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(isOk(result)).toBe(true);
  });

  it("retries retryable RateLimited", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const rateLimitError = createSdkError("RateLimited", "Rate limited", { retryable: true });
    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { error: rateLimitError }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(isOk(result)).toBe(true);
  });

  it("does not retry InvalidConfig", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const error = createSdkError("InvalidConfig", "Invalid config", { retryable: false });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error }]]),
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
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidConfig");
    }
  });

  it("does not retry InvalidResponse", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const error = createSdkError("InvalidResponse", "Invalid response", { retryable: false });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error }]]),
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
  });

  it("fails with error when non-retryable error occurs", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const error = createSdkError("InvalidTransaction", "Invalid transaction");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error }]]),
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
  });

  it("falls back from first endpoint to second endpoint after retryable failure", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
    const transport1 = createFakeRpcTransport({
      endpointUrl: "https://api1.solana.com",
      endpointId: "https_api1_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: "https://api2.solana.com",
      endpointId: "https_api2_solana_com",
      responses: new Map([["getBalance", { success: 2000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBe(2000);
    }
  });

  it("returns AllEndpointsFailed when all retryable attempts fail", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
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
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
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

  it("opens circuit after consecutive failures reach threshold", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

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
  });

  it("skips circuit-open endpoint", async () => {
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

    // Manually open circuit on first endpoint
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
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
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
    expect(transport1.callCount()).toBe(0);
  });

  it("closes expired circuit before selection", async () => {
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

    clock.advance(150);

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
    const closedState = registryResult.value.getById("https_api_solana_com");
    expect(closedState?.circuitOpenUntil).toBeUndefined();
  });

  it("uses scoring to choose lower-latency endpoint", async () => {
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

    const state1 = registryResult.value.getById("https_api1_solana_com");
    if (state1) {
      registryResult.value.upsert({
        ...state1,
        avgLatencyMs: 1000,
        successCount: 1,
      });
    }

    const state2 = registryResult.value.getById("https_api2_solana_com");
    if (state2) {
      registryResult.value.upsert({
        ...state2,
        avgLatencyMs: 10,
        successCount: 1,
      });
    }

    const result = await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
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
  });

  it("respects maxAttempts", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
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
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
      {
        retry: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
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

  it("uses backoff timer when backoff is greater than zero", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([
        ["getBalance", { error: timeoutError }],
        ["getBalance", { success: 1000 }],
      ]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([0.5]);

    const resultPromise = executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    clock.advance(150);
    await timer.flush();

    const result = await resultPromise;

    expect(isOk(result)).toBe(true);
  });

  it("does not wait when backoff is zero", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error: timeoutError }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(transport.callCount()).toBeGreaterThan(1);
  });

  it("passes default timeout to executeRpcAttempt", async () => {
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

    await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
        defaultTimeoutMs: 5000,
      },
      { registry: registryResult.value, clock, timer, random },
    );

    const calls = transport.getCalls();
    expect(calls[0]!.options?.timeoutMs).toBe(5000);
  });

  it("prefers endpoint-specific timeout over default timeout", async () => {
    const registryResult = createEndpointRegistry([{ url: "https://api.solana.com", timeoutMs: 3000 }]);
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

    await executeResilientRpcRequest(
      "getBalance",
      { address: "test" },
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
        defaultTimeoutMs: 5000,
      },
      { registry: registryResult.value, clock, timer, random },
    );

    const calls = transport.getCalls();
    expect(calls[0]!.options?.timeoutMs).toBe(3000);
  });
});

describe("createResilientRpcClient", () => {
  it("returns an object compatible with RpcTransport", () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map(),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const client = createResilientRpcClient(
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    expect(client.endpointUrl).toBeDefined();
    expect(client.endpointId).toBeDefined();
    expect(typeof client.send).toBe("function");
  });

  it("send resolves with raw RPC result on success", async () => {
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

    const client = createResilientRpcClient(
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    const result = await client.send("getBalance", { address: "test" });

    expect(result).toBe(1000);
  });

  it("send throws SDK error on failure", async () => {
    const registryResult = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const error = createSdkError("NetworkError", "Connection failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "https_api_solana_com",
      responses: new Map([["getBalance", { error }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const client = createResilientRpcClient(
      new Map([["https_api_solana_com", transport]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    await expect(client.send("getBalance", { address: "test" })).rejects.toMatchObject({
      kind: "NetworkError",
    });
  });

  it("uses the same resilience flow as executeResilientRpcRequest", async () => {
    const registryResult = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(registryResult)).toBe(true);
    if (!isOk(registryResult)) throw new Error("Failed to create registry");

    const timeoutError = createSdkError("Timeout", "Timed out", { retryable: true });
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

    const client = createResilientRpcClient(
      new Map([["https_api1_solana_com", transport1], ["https_api2_solana_com", transport2]]),
      {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 1000, jitterRatio: 0.1 },
        circuitBreaker: { failureThreshold: 3, openDurationMs: 10000 },
        scoring: { latencyWeight: 1, failureWeight: 1, recentFailurePenalty: 1 },
      },
      { registry: registryResult.value, clock, timer, random },
    );

    const result = await client.send("getBalance", { address: "test" });

    expect(result).toBe(5000);
  });
});
