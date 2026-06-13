/**
 * Integration test: RPC fallback between endpoints.
 *
 * Verifies that the resilient client falls back to next endpoint
 * when the first one fails.
 */

import { describe, it } from "vitest";

describe("RPC Fallback", () => {
  it("falls back to second endpoint when first fails", () => {
    // TODO: create 2 fake endpoints, first fails, second succeeds,
    // execute request via resilient client,
    // assert ok result from second endpoint
  });

  it("exhausts all endpoints and returns error", () => {
    // TODO: create 3 endpoints all failing,
    // execute request, assert err(AllEndpointsFailed)
  });

  it("retries first endpoint after success on fallback", () => {
    // TODO: first endpoint fails, second succeeds,
    // execute another request, assert first endpoint tried again
    // (circuit not permanently closed)
  });
});
