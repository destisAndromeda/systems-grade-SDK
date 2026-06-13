/**
 * Tests for CLI health command helpers.
 */

import { describe, it, expect } from "vitest";
import { formatEndpointHealth, createHealthReport } from "../../src/cli/health.js";

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

describe("createHealthReport", () => {
  it("returns usage text when no endpoints provided", () => {
    const result = createHealthReport([]);
    expect(result).toContain("Usage");
    expect(result).toContain("health");
  });

  it("returns usage text when endpoints array is empty", () => {
    const result = createHealthReport([]);
    expect(result).toContain("Usage");
  });

  it("returns health report for valid endpoints", () => {
    const result = createHealthReport(["https://api.mainnet-beta.solana.com"]);
    expect(result).not.toContain("Usage");
    expect(result).toContain("RPC Endpoint Health");
  });

  it("includes multiple endpoints in report", () => {
    const result = createHealthReport([
      "https://api.mainnet-beta.solana.com",
      "https://backup.rpc.solana.com",
    ]);

    expect(result).toContain("https://api.mainnet-beta.solana.com");
    expect(result).toContain("https://backup.rpc.solana.com");
  });

  it("does not make real network calls", () => {
    // This should complete quickly with fake transports
    const start = Date.now();
    const result = createHealthReport(["https://api.mainnet-beta.solana.com"]);
    const elapsed = Date.now() - start;

    // Should complete in less than 100ms (no real network)
    expect(elapsed).toBeLessThan(100);
    expect(result.length).toBeGreaterThan(0);
  });
});
