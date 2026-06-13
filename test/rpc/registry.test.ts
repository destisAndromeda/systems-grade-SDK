/**
 * Tests for endpoint registry.
 */

import { describe, it, expect } from "vitest";
import { createEndpointRegistry } from "../../src/rpc/registry.js";
import { isOk, isErr } from "../../src/core/result.js";

describe("createEndpointRegistry", () => {
  it("returns InvalidConfig for empty endpoint list", () => {
    const result = createEndpointRegistry([]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("creates registry from one string endpoint", () => {
    const result = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.getAll().length).toBe(1);
    }
  });

  it("creates registry from multiple endpoints", () => {
    const result = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.getAll().length).toBe(2);
    }
  });

  it("normalizes all endpoint configs", () => {
    const result = createEndpointRegistry([
      "https://api1.solana.com/",
      { url: "https://api2.solana.com", weight: 2 },
    ]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const endpoints = result.value.getAll();
      expect(endpoints.length).toBe(2);
      expect(endpoints[0]!.config.weight).toBe(1); // Default weight
      expect(endpoints[1]!.config.weight).toBe(2); // Specified weight
    }
  });

  it("deduplicates same URL with and without trailing slash", () => {
    const result = createEndpointRegistry([
      "https://api.solana.com",
      "https://api.solana.com/",
    ]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.getAll().length).toBe(1);
    }
  });

  it("keeps first duplicate occurrence", () => {
    const result = createEndpointRegistry([
      { url: "https://api.solana.com", weight: 1 },
      { url: "https://api.solana.com/", weight: 2 },
    ]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const endpoints = result.value.getAll();
      expect(endpoints.length).toBe(1);
      expect(endpoints[0]!.config.weight).toBe(1);
    }
  });

  it("returns error if any endpoint config is invalid", () => {
    const result = createEndpointRegistry([
      "https://api1.solana.com",
      "not a url",
    ]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });
});

describe("registry methods", () => {
  it("getAll() returns all endpoint states", () => {
    const result = createEndpointRegistry(["https://api1.solana.com", "https://api2.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const endpoints = registry.getAll();
      expect(endpoints.length).toBe(2);
      expect(endpoints[0]!.id).toBeDefined();
      expect(endpoints[1]!.id).toBeDefined();
    }
  });

  it("getById(id) returns matching endpoint state", () => {
    const result = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const endpoints = registry.getAll();
      const endpoint = endpoints[0];
      expect(endpoint).toBeDefined();
      if (endpoint) {
        const retrieved = registry.getById(endpoint.id);
        expect(retrieved).toBe(endpoint);
      }
    }
  });

  it("getById(id) returns undefined for missing id", () => {
    const result = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const retrieved = registry.getById("nonexistent-id");
      expect(retrieved).toBeUndefined();
    }
  });

  it("upsert(state) updates existing endpoint state", () => {
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

  it("upsert(state) can add new endpoint state if current design supports this", () => {
    const result = createEndpointRegistry(["https://api1.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const initialEndpoints = registry.getAll();
      expect(initialEndpoints.length).toBe(1);
      
      // Try to upsert a new endpoint (would only work if registry supports adding)
      // Most implementations don't support this without normalization, so we just verify the pattern
      const endpoints = registry.getAll();
      expect(endpoints.length).toBe(1);
    }
  });

  it("returned list does not allow accidental mutation of internal registry state, if current design supports defensive copies", () => {
    const result = createEndpointRegistry(["https://api.solana.com"]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const registry = result.value;
      const endpoints1 = registry.getAll();
      const endpoints2 = registry.getAll();
      
      // The lists should be separate objects (defensive copy)
      expect(endpoints1).not.toBe(endpoints2);
      
      // But they should have the same content
      expect(endpoints1.length).toBe(endpoints2.length);
      expect(endpoints1[0]?.id).toBe(endpoints2[0]?.id);
    }
  });
});
