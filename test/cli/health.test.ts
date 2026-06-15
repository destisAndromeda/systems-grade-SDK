/**
 * Tests for CLI health command helpers.
 */

import { describe, it, expect, vi } from "vitest";
import {
  formatEndpointHealth,
  createHealthReport,
  createActiveHealthReport,
  watchHealth,
} from "../../src/cli/health.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createEndpointId, normalizeRpcEndpointConfig } from "../../src/rpc/endpoint.js";
import { isOk } from "../../src/core/result.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the endpoint ID the SDK would assign to a URL. */
function endpointIdFor(url: string): string {
  const result = normalizeRpcEndpointConfig(url);
  if (!isOk(result)) throw new Error(`Bad URL: ${url}`);
  return createEndpointId(result.value);
}

// ---------------------------------------------------------------------------
// formatEndpointHealth
// ---------------------------------------------------------------------------

describe("formatEndpointHealth", () => {
  it("returns useful message for empty health list", () => {
    const result = formatEndpointHealth([]);
    expect(result).toBe("No endpoints configured.");
  });

  it("includes endpoint URL in output", () => {
    const health = [
      {
        id: "test-endpoint",
        url: "https://test.rpc.solana.com",
        successCount: 10,
        failureCount: 2,
        consecutiveFailures: 0,
        avgLatencyMs: 150,
        circuitOpen: false,
      },
    ];

    const result = formatEndpointHealth(health);
    expect(result).toContain("https://test.rpc.solana.com");
  });

  it("includes success/failure counts in output", () => {
    const health = [
      {
        id: "test-endpoint",
        url: "https://test.rpc.solana.com",
        successCount: 10,
        failureCount: 2,
        consecutiveFailures: 0,
        avgLatencyMs: 150,
        circuitOpen: false,
      },
    ];

    const result = formatEndpointHealth(health);
    expect(result).toContain("Success: 10");
    expect(result).toContain("Failures: 2");
  });

  it("includes consecutive failures in output", () => {
    const health = [
      {
        id: "test-endpoint",
        url: "https://test.rpc.solana.com",
        successCount: 10,
        failureCount: 5,
        consecutiveFailures: 3,
        avgLatencyMs: 150,
        circuitOpen: false,
      },
    ];

    const result = formatEndpointHealth(health);
    expect(result).toContain("Consecutive Failures: 3");
  });

  it("shows circuit state in output", () => {
    const healthOpen = [
      {
        id: "test-open",
        url: "https://test.rpc.solana.com",
        successCount: 5,
        failureCount: 10,
        consecutiveFailures: 5,
        avgLatencyMs: 150,
        circuitOpen: true,
      },
    ];

    const resultOpen = formatEndpointHealth(healthOpen);
    expect(resultOpen).toContain("OPEN");

    const healthClosed = [
      {
        id: "test-closed",
        url: "https://test.rpc.solana.com",
        successCount: 10,
        failureCount: 2,
        consecutiveFailures: 0,
        avgLatencyMs: 150,
        circuitOpen: false,
      },
    ];

    const resultClosed = formatEndpointHealth(healthClosed);
    expect(resultClosed).toContain("CLOSED");
  });

  it("includes latency information", () => {
    const health = [
      {
        id: "test-endpoint",
        url: "https://test.rpc.solana.com",
        successCount: 10,
        failureCount: 2,
        consecutiveFailures: 0,
        avgLatencyMs: 250.5,
        circuitOpen: false,
      },
    ];

    const result = formatEndpointHealth(health);
    expect(result).toContain("Avg Latency");
    expect(result).toContain("250.5");
    expect(result).toContain("ms");
  });
});

// ---------------------------------------------------------------------------
// createHealthReport (async version required by Phase 9)
// ---------------------------------------------------------------------------

describe("createHealthReport", () => {
  it("returns usage text when no endpoints provided", async () => {
    const result = await createHealthReport([]);
    expect(result).toContain("Usage");
    expect(result).toContain("health");
  });

  it("returns usage text when endpoints array is empty", async () => {
    const result = await createHealthReport([]);
    expect(result).toContain("Usage");
  });

  it("returns health report for valid endpoints", async () => {
    const result = await createHealthReport(["https://api.mainnet-beta.solana.com"]);
    expect(result).not.toContain("Usage");
    expect(result).toContain("RPC Health Report");
  });

  it("includes multiple endpoints in report", async () => {
    const result = await createHealthReport([
      "https://api.mainnet-beta.solana.com",
      "https://backup.rpc.solana.com",
    ]);

    expect(result).toContain("https://api.mainnet-beta.solana.com");
    expect(result).toContain("https://backup.rpc.solana.com");
  });

  it("does not make real network calls", async () => {
    // This should complete quickly with fake transports
    const start = Date.now();
    const result = await createHealthReport(["https://api.mainnet-beta.solana.com"]);
    const elapsed = Date.now() - start;

    // Should complete in less than 100ms (no real network)
    expect(elapsed).toBeLessThan(100);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createActiveHealthReport
// ---------------------------------------------------------------------------

describe("createActiveHealthReport", () => {
  it("returns usage text when no endpoints provided", async () => {
    const result = await createActiveHealthReport([]);
    expect(result).toContain("Usage");
    expect(result).toContain("health");
  });

  it("probes RPC and includes non-zero success count", async () => {
    const url = "https://api.test";
    const id = endpointIdFor(url);

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: url,
      endpointId: id,
      responses: new Map([["getHealth", { success: "ok" }]]),
    });

    const transports = new Map([[id, fakeTransport]]);

    const result = await createActiveHealthReport([url], {}, { transports });

    expect(result).toContain("RPC Endpoint Health");
    expect(result).toContain("Success: 1");
    expect(result).toContain("Probe: ok");
  });

  it("records failed probe and still renders report", async () => {
    const url = "https://api.test";
    const id = endpointIdFor(url);

    const { createSdkError } = await import("../../src/core/error.js");
    const fakeError = createSdkError("NetworkError", "connection refused");

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: url,
      endpointId: id,
      responses: new Map([["getHealth", { error: fakeError }]]),
    });

    const transports = new Map([[id, fakeTransport]]);

    const result = await createActiveHealthReport([url], {}, { transports });

    // Report still rendered, probe shows error
    expect(result).toContain("RPC Endpoint Health");
    expect(result).toContain("Probe: error");
  });
});

// ---------------------------------------------------------------------------
// watchHealth
// ---------------------------------------------------------------------------

describe("watchHealth", () => {
  it("writes multiple reports and sleeps between iterations", async () => {
    const url = "https://api.test";
    const id = endpointIdFor(url);

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: url,
      endpointId: id,
      responses: new Map([["getHealth", { success: "ok" }]]),
    });

    const transports = new Map([[id, fakeTransport]]);
    const written: string[] = [];
    const sleepCalls: number[] = [];

    const fixedNow = new Date("2026-06-14T08:00:00.000Z").getTime();

    await watchHealth(
      [url],
      { iterations: 2, intervalMs: 100 },
      {
        transports,
        write: (text) => written.push(text),
        sleep: (ms) => {
          sleepCalls.push(ms);
          return Promise.resolve();
        },
        nowMs: () => fixedNow,
      },
    );

    // write called once per iteration
    expect(written.length).toBe(2);
    // sleep called once (between first and second iteration; not after last)
    expect(sleepCalls.length).toBe(1);
    expect(sleepCalls[0]).toBe(100);
    // timestamp present
    expect(written[0]).toContain("Updated:");
    expect(written[0]).toContain("2026-06-14");
    // health report present
    expect(written[0]).toContain("RPC Health Report");
  });

  it("writes usage and returns when endpoints are missing", async () => {
    const written: string[] = [];

    await watchHealth(
      [],
      { iterations: 5 },
      {
        write: (text) => written.push(text),
        sleep: () => Promise.resolve(),
      },
    );

    expect(written.length).toBe(1);
    expect(written[0]).toContain("Usage");
  });
});
