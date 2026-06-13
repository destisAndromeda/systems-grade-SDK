/**
 * Integration test: Relay fallback to RPC.
 *
 * Verifies that transactions can be routed through relay first,
 * then fall back to standard RPC if relay fails.
 */

import { describe, it } from "vitest";

describe("Relay Fallback to RPC", () => {
  it("sends via relay and returns relay route on success", () => {
    // TODO: create relay client and RPC transport,
    // relay succeeds, execute routeTransaction,
    // assert ok with route="relay" and relayName set
  });

  it("falls back to RPC if relay fails", () => {
    // TODO: relay fails, RPC succeeds, fallbackToRpc=true,
    // execute routeTransaction, assert ok with route="rpc"
  });

  it("returns error if relay fails and fallback disabled", () => {
    // TODO: relay fails, fallbackToRpc=false,
    // assert err (doesn't try RPC)
  });

  it("tries multiple relays before falling back to RPC", () => {
    // TODO: create 2 relay clients, both fail, RPC succeeds,
    // assert RPC tried after both relays fail
  });
});
