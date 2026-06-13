/**
 * Tests for wallet adapter.
 */

import { describe, it } from "vitest";

describe("signTransactionWithWallet", () => {
  it("calls wallet.signTransaction and returns signed tx", () => {
    // TODO: create fake wallet, sign transaction, assert ok with signed result
  });

  it("returns error if signing fails", () => {
    // TODO: create fake wallet that fails, assert err
  });
});

describe("sendViaWallet", () => {
  it("signs transaction and sends via transport", () => {
    // TODO: create fake wallet and transport, call sendViaWallet,
    // assert ok with signature
  });

  it("returns error if signing fails", () => {
    // TODO: wallet fails, assert err (doesn't reach send)
  });

  it("returns error if send fails", () => {
    // TODO: wallet succeeds, transport fails, assert err
  });
});
