/**
 * Integration test: Transaction confirmation with timeout.
 *
 * Verifies that confirmation polling returns confirmed before timeout,
 * or times out if status never becomes final.
 */

import { describe, it } from "vitest";

describe("Transaction Confirmation Timeout", () => {
  it("returns confirmed before timeout", () => {
    // TODO: create fake transport that returns confirmed status after 1 poll,
    // poll with timeout=5000, assert ok with confirmed status and elapsed < 5000
  });

  it("returns timeout when status never becomes final", () => {
    // TODO: create fake transport that always returns pending,
    // poll with timeout=1000, assert err(Timeout) when timeout reached
  });

  it("stops polling after terminal status reached", () => {
    // TODO: transport returns pending then finalized,
    // poll, assert stops at finalized (doesn't poll again)
  });

  it("respects poll interval", () => {
    // TODO: use fake timer, confirm poll happens at correct intervals
  });
});
