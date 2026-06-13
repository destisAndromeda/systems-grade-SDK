/**
 * Tests for transaction confirmation.
 */

import { describe, it } from "vitest";
import { isTerminalStatus } from "../../src/tx/confirm";

describe("isTerminalStatus", () => {
  it("returns true for confirmed status", () => {
    // TODO: assert isTerminalStatus({ kind: "confirmed", ... }) === true
  });

  it("returns true for finalized status", () => {
    // TODO: assert isTerminalStatus({ kind: "finalized", ... }) === true
  });

  it("returns true for failed status", () => {
    // TODO: assert isTerminalStatus({ kind: "failed", ... }) === true
  });

  it("returns false for pending status", () => {
    // TODO: assert isTerminalStatus({ kind: "pending", ... }) === false
  });
});

describe("pollTransactionConfirmation", () => {
  it("returns confirmed before timeout", () => {
    // TODO: create fake transport that returns confirmed status,
    // poll with fake timer/clock, assert ok result with confirmed status
  });

  it("returns timeout error when status never becomes final", () => {
    // TODO: create fake transport that always returns pending,
    // poll until timeout, assert err(Timeout)
  });

  it("returns final status with elapsed time", () => {
    // TODO: poll transaction, assert result includes totalWaitMs
  });
});
