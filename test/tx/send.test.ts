/**
 * Tests for transaction sending.
 */

import { describe, it } from "vitest";
import { buildPreparedTransaction, isBlockhashExpired } from "../../src/tx/send";

describe("buildPreparedTransaction", () => {
  it("creates prepared transaction with valid inputs", () => {
    // TODO: assert buildPreparedTransaction(base64, blockhash, height) returns ok
  });

  it("returns error for invalid base64", () => {
    // TODO: assert buildPreparedTransaction("not-base64", ...) returns err(InvalidConfig)
  });

  it("returns error for empty blockhash", () => {
    // TODO: assert buildPreparedTransaction(base64, "", height) returns err
  });
});

describe("isBlockhashExpired", () => {
  it("returns true when current height exceeds last valid", () => {
    // TODO: create prepared tx with lastValidBlockHeight=100,
    // assert isBlockhashExpired(tx, 101) === true
  });

  it("returns false when current height is below last valid", () => {
    // TODO: assert isBlockhashExpired(tx, 99) === false
  });

  it("returns false when heights equal", () => {
    // TODO: assert isBlockhashExpired(tx, 100) === false (use < not <=)
  });
});
