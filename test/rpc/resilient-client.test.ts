/**
 * Tests for resilient RPC client.
 */

import { describe, it } from "vitest";

describe("createResilientRpcClient", () => {
  it("returns ok on first successful attempt", () => {
    // TODO: create client with one transport that succeeds,
    // execute request, assert ok result with signature
  });

  it("retries on retryable failure and succeeds on second endpoint", () => {
    // TODO: create client with 2 endpoints, first fails with Timeout, second succeeds,
    // execute request, assert ok result and second endpoint was tried
  });

  it("returns error when all endpoints fail", () => {
    // TODO: create client with 2 endpoints, both fail with non-retryable error,
    // assert err(AllEndpointsFailed)
  });

  it("records endpoint state after each attempt", () => {
    // TODO: execute request, assert registry state updated with success/failure
  });

  it("opens circuit for endpoint after repeated failures", () => {
    // TODO: fail an endpoint enough times to hit threshold,
    // assert circuitOpenUntil is set in endpoint state
  });

  it("avoids circuit-open endpoints", () => {
    // TODO: open circuit on first endpoint, execute request,
    // assert only second endpoint was tried
  });
});
