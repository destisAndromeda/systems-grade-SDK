/**
 * Tests for endpoint registry.
 */

import { describe, it, expect } from "vitest";
import { createEndpointRegistry } from "../../src/rpc/registry.js";
import { isOk, isErr } from "../../src/core/result.js";

describe("createEndpointRegistry", () => {
  it("creates registry from array of endpoint URLs", () => {
    const result = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      expect(registry.getAll().length).toBe(2);
    }
  });

  it("deduplicates equivalent endpoints by URL", () => {
    const result = createEndpointRegistry([
      "https://api.solana.com",
      "https://api.solana.com/",
    ]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.getAll().length).toBe(1);
    }
  });

  it("returns error for empty config array", () => {
    const result = createEndpointRegistry([]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("initializes endpoint state with zero counters", () => {
    const result = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const endpoints = registry.getAll();
      const firstEndpoint = endpoints[0];
      expect(firstEndpoint).toBeDefined();
      if (firstEndpoint) {
        expect(firstEndpoint.successCount).toBe(0);
        expect(firstEndpoint.failureCount).toBe(0);
        expect(firstEndpoint.consecutiveFailures).toBe(0);
        expect(firstEndpoint.avgLatencyMs).toBe(0);
      }
    }
  });

  it("upsert() updates endpoint state", () => {
    const result = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const state = registry.getAll()[0];
      expect(state).toBeDefined();
      if (state) {
        const updated = { ...state, successCount: 5 };
        registry.upsert(updated);
        const retrieved = registry.getById(state.id);
        expect(retrieved?.successCount).toBe(5);
      }
    }
  });
});
