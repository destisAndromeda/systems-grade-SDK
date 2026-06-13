/**
 * Tests for Jito relay client.
 */

import { describe, it } from "vitest";

describe("createJitoRelayClient", () => {
  it("creates a relay client with Jito endpoint", () => {
    // TODO: create Jito relay with URL, assert name includes "Jito"
  });

  it("sends transaction and returns signature", () => {
    // TODO: create fake Jito transport that succeeds,
    // call sendTransaction, assert ok with signature
  });

  it("returns error on send failure", () => {
    // TODO: create fake Jito transport that fails,
    // call sendTransaction, assert err
  });
});
