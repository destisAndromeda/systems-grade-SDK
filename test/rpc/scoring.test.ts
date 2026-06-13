/**
 * Tests for endpoint scoring and selection.
 */

import { describe, it } from "vitest";
import { scoreEndpoint, selectBestEndpoint } from "../../src/rpc/scoring";

describe("scoreEndpoint", () => {
  it("returns lower score for lower latency", () => {
    // TODO: create endpoint with avgLatencyMs=50, score it, assert lower than endpoint with avgLatencyMs=100
  });

  it("returns lower score for fewer failures", () => {
    // TODO: create endpoint with 1 failure vs 5 failures, assert lower-failure has lower score
  });

  it("handles zero-attempt endpoint without division errors", () => {
    // TODO: score endpoint with successCount=0, failureCount=0, assert no NaN/Infinity
  });

  it("applies recent failure penalty", () => {
    // TODO: score endpoint with recent vs old failure, assert recent has higher score
  });
});

describe("selectBestEndpoint", () => {
  it("selects endpoint with lowest score", () => {
    // TODO: create 3 endpoints with different scores, selectBestEndpoint returns lowest-scoring one
  });

  it("excludes circuit-open endpoints", () => {
    // TODO: create 2 endpoints, open circuit on one, assert selection picks the other
  });

  it("returns error if all endpoints circuit-open", () => {
    // TODO: open circuit on all, assert selectBestEndpoint returns err(AllEndpointsFailed)
  });
});
