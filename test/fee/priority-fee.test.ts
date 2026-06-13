/**
 * Tests for priority fee logic.
 */

import { describe, it } from "vitest";
import { isPriorityFeeStale } from "../../src/fee/priority-fee.js";

describe("createStaticPriorityFeeProvider", () => {
  it("returns configured fee estimate", () => {
    // TODO: create static provider with fee=100, get estimate, assert === 100
  });

  it("timestamps estimate with current time", () => {
    // TODO: create static provider, get estimate, assert fetchedAtMs === clock.now()
  });
});

describe("isPriorityFeeStale", () => {
  it("returns true when estimate is older than maxStaleMs", () => {
    // TODO: create estimate at time=0, check at time=100, maxStale=50,
    // assert isPriorityFeeStale returns true
  });

  it("returns false when estimate is fresh", () => {
    // TODO: assert isPriorityFeeStale returns false for recent estimate
  });
});

describe("getPriorityFeeEstimate", () => {
  it("returns first non-stale estimate", () => {
    // TODO: create 2 providers, first is stale, second is fresh,
    // assert getPriorityFeeEstimate returns second provider's estimate
  });

  it("returns fallback if all stale or fail", () => {
    // TODO: all providers fail/stale, assert returns fallbackMicroLamports
  });
});
