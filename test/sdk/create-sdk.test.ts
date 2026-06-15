/**
 * Tests for SDK creation and validation.
 */

import { describe, it, expect } from "vitest";
import { validateSdkConfig, createSolanaReliabilitySdk } from "../../src/sdk/create-sdk.js";
import { isOk, isErr } from "../../src/core/result.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";
import { createFakeTimer } from "../../src/testing/fake-timer.js";
import { createFakeRandom } from "../../src/testing/fake-random.js";
import { createInMemoryMetricsSink } from "../../src/metrics/memory.js";

describe("validateSdkConfig", () => {
  it("accepts minimal valid config", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
    });
    expect(isOk(result)).toBe(true);
  });

  it("rejects empty endpoints", () => {
    const result = validateSdkConfig({
      endpoints: [],
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("rejects undefined endpoints", () => {
    const result = validateSdkConfig({
      endpoints: undefined as any,
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid retry maxAttempts (zero)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      retry: { maxAttempts: 0 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid retry maxAttempts (negative)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      retry: { maxAttempts: -1 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects negative retry baseDelayMs", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      retry: { baseDelayMs: -1 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid circuit breaker failureThreshold (zero)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      circuitBreaker: { failureThreshold: 0 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects negative circuit breaker cooldownMs", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      circuitBreaker: { cooldownMs: -1 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid default timeout (zero)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      defaultTimeoutMs: 0,
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid default timeout (negative)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      defaultTimeoutMs: -1,
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid confirmation timeout (zero)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      confirmation: { timeoutMs: 0 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid confirmation pollIntervalMs (zero)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      confirmation: { pollIntervalMs: 0 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid priority fee fallback (negative)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      priorityFee: { fallbackMicroLamports: -1 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("rejects invalid priority fee maxStaleMs (negative)", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      priorityFee: { maxStaleMs: -1 },
    });
    expect(isErr(result)).toBe(true);
  });

  it("accepts valid retry config", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      retry: {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
      },
    });
    expect(isOk(result)).toBe(true);
  });

  it("accepts valid circuit breaker config", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      circuitBreaker: {
        failureThreshold: 5,
        cooldownMs: 30000,
      },
    });
    expect(isOk(result)).toBe(true);
  });

  it("accepts valid priority fee config", () => {
    const result = validateSdkConfig({
      endpoints: ["https://api.com"],
      priorityFee: {
        fallbackMicroLamports: 100,
        maxStaleMs: 30000,
      },
    });
    expect(isOk(result)).toBe(true);
  });
});

describe("createSolanaReliabilitySdk", () => {
  it("creates SDK with minimal valid config", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(sdk).toBeDefined();
      expect(sdk.rpc).toBeDefined();
      expect(typeof sdk.sendTransaction).toBe("function");
      expect(typeof sdk.confirmTransaction).toBe("function");
      expect(typeof sdk.getPriorityFee).toBe("function");
      expect(typeof sdk.getEndpointHealth).toBe("function");
    }
  });

  it("returns error for invalid config", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: [],
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("exposes rpc transport", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(sdk.rpc).toBeDefined();
      expect(sdk.rpc.endpointUrl).toBe("resilient://rpc");
      expect(sdk.rpc.endpointId).toBe("resilient-rpc");
      expect(typeof sdk.rpc.send).toBe("function");
    }
  });

  it("exposes sendTransaction", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(typeof sdk.sendTransaction).toBe("function");
    }
  });

  it("exposes confirmTransaction", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(typeof sdk.confirmTransaction).toBe("function");
    }
  });

  it("exposes getPriorityFee", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(typeof sdk.getPriorityFee).toBe("function");
    }
  });

  it("exposes getEndpointHealth", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(typeof sdk.getEndpointHealth).toBe("function");
    }
  });

  it("exposes getMetrics", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      expect(typeof sdk.getMetrics).toBe("function");
    }
  });

  it("uses provided fake transports", () => {
    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.com",
      endpointId: "test-endpoint",
      responses: new Map([
        ["sendTransaction", { success: "test-sig" }],
      ]),
    });

    const transports = new Map([["test-endpoint", fakeTransport]]);

    const result = createSolanaReliabilitySdk(
      {
        endpoints: ["https://api.com"],
      },
      {
        transports,
      },
    );

    expect(isOk(result)).toBe(true);
  });

  it("getEndpointHealth() returns endpoint info", () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com", "https://api2.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      const health = sdk.getEndpointHealth();
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThan(0);

      for (const endpoint of health) {
        expect(typeof endpoint.id).toBe("string");
        expect(typeof endpoint.url).toBe("string");
        expect(typeof endpoint.successCount).toBe("number");
        expect(typeof endpoint.failureCount).toBe("number");
        expect(typeof endpoint.consecutiveFailures).toBe("number");
        expect(typeof endpoint.avgLatencyMs).toBe("number");
        expect(typeof endpoint.circuitOpen).toBe("boolean");
      }
    }
  });

  it("metrics sink can record events", async () => {
    const result = createSolanaReliabilitySdk({
      endpoints: ["https://api.com"],
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      const metrics = sdk.getMetrics();
      // May be empty or have initial events
      expect(Array.isArray(metrics)).toBe(true);
    }
  });

  it("integrates genesis guard and quarantines non-majority endpoints", async () => {
    const ep1 = "https://api1.com";
    const ep2 = "https://api2.com";
    const ep1_id = "https_api1_com";
    const ep2_id = "https_api2_com";

    const transport1 = createFakeRpcTransport({
      endpointUrl: ep1,
      endpointId: ep1_id,
      responses: new Map([["getGenesisHash", { success: "hash-A" }]]),
    });
    const transport2 = createFakeRpcTransport({
      endpointUrl: ep2,
      endpointId: ep2_id,
      responses: new Map([["getGenesisHash", { success: "hash-B" }]]),
    });

    const transports = new Map([
      [ep1_id, transport1],
      [ep2_id, transport2],
    ]);

    const result = createSolanaReliabilitySdk(
      {
        endpoints: [ep1, ep2],
        enableGenesisGuard: true,
      },
      {
        transports,
      },
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const sdk = result.value;
      await sdk.genesisGuardPromise;

      expect(sdk.genesisHash).toBe("hash-A");
      expect(sdk.quarantinedEndpoints).toEqual([ep2]);

      const health = sdk.getEndpointHealth();
      const ep2Health = health.find(h => h.url === ep2);
      expect(ep2Health?.circuitOpen).toBe(true);
    }
  });
});

