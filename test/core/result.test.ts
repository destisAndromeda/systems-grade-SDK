/**
 * Tests for result type and utilities.
 */

import { describe, it } from "vitest";
import { ok, err, isOk, isErr, mapResult } from "../../src/core/result";

describe("Result", () => {
  it("ok() creates a successful Result", () => {
    // TODO: assert ok(42) returns { ok: true, value: 42 }
  });

  it("err() creates a failed Result", () => {
    // TODO: assert err(new Error("test")) returns { ok: false, error: ... }
  });

  it("isOk() correctly identifies success", () => {
    // TODO: assert isOk(ok(1)) === true, isOk(err(new Error())) === false
  });

  it("isErr() correctly identifies failure", () => {
    // TODO: assert isErr(err(new Error())) === true, isErr(ok(1)) === false
  });

  it("mapResult() transforms value on success", () => {
    // TODO: assert mapResult(ok(2), x => x * 2) returns ok(4)
  });

  it("mapResult() passes through error unchanged", () => {
    // TODO: assert mapResult(err(e), ...) returns same error unchanged
  });
});
