/**
 * Tests for endpoint registry.
 */

import { describe, it } from "vitest";
import { createEndpointRegistry } from "../../src/rpc/registry.js";

describe("createEndpointRegistry", () => {
  it("creates registry from array of endpoint URLs", () => {
    // TODO: createEndpointRegistry(["https://api1.com", "https://api2.com"])
    // assert registry.getAll() returns 2 endpoints
  });

  it("deduplicates equivalent endpoints by URL", () => {
    // TODO: pass ["https://api.com", "https://api.com/"], assert result has 1 endpoint
  });

  it("returns error for empty config array", () => {
    // TODO: assert createEndpointRegistry([]) returns err(InvalidConfig)
  });

  it("initializes endpoint state with zero counters", () => {
    // TODO: create registry, getState, assert successCount/failureCount === 0
  });

  it("upsert() updates endpoint state", () => {
    // TODO: getById, mutate state, upsert, assert state updated in registry
  });
});
