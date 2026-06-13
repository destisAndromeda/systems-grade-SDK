/**
 * Tests for relay routing.
 */

import { describe, it } from "vitest";

describe("routeTransaction", () => {
  it("sends via relay and returns relay route on success", () => {
    // TODO: create relay client and route, execute routeTransaction,
    // assert ok result with route="relay"
  });

  it("falls back to RPC if relay fails and fallback enabled", () => {
    // TODO: create relay that fails, RPC that succeeds, fallbackToRpc=true,
    // assert ok result with route="rpc"
  });

  it("returns error if relay fails and fallback disabled", () => {
    // TODO: create relay that fails, fallbackToRpc=false,
    // assert err (doesn't try RPC)
  });

  it("returns error if both relay and RPC fail", () => {
    // TODO: both fail, assert err with appropriate message
  });
});
