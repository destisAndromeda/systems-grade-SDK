/**
 * Integration test: Metrics export during request lifecycle.
 *
 * Verifies that metrics are emitted for each phase of request execution
 * (send, retry, circuit breaker, confirmation).
 */

import { describe, it } from "vitest";

describe("Metrics Export", () => {
  it("emits metric for successful RPC attempt", () => {
    // TODO: execute request, check metrics sink,
    // assert rpc_success event recorded with latencyMs and endpointId
  });

  it("emits metric for failed RPC attempt", () => {
    // TODO: fail request, assert rpc_failure event recorded with error kind
  });

  it("emits metric for retry", () => {
    // TODO: fail first, succeed second attempt,
    // assert retry event recorded
  });

  it("emits metric when circuit opens", () => {
    // TODO: fail endpoint to open circuit,
    // assert circuit_open event recorded with endpointId
  });

  it("emits metrics for transaction lifecycle", () => {
    // TODO: send and confirm transaction,
    // assert tx_send, tx_confirmed events recorded
  });
});
