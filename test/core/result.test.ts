/**
 * Tests for result type and utilities.
 */

import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, mapResult, unwrapResult } from "../../src/core/result.js";

describe("Result", () => {
  it("ok() creates a successful Result", () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("err() creates a failed Result", () => {
    const error = new Error("test error");
    const result = err(error);
    expect(result).toEqual({ ok: false, error });
  });

  it("isOk() correctly identifies success", () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isOk(err(new Error()))).toBe(false);
  });

  it("isErr() correctly identifies failure", () => {
    expect(isErr(err(new Error()))).toBe(true);
    expect(isErr(ok(1))).toBe(false);
  });

  it("mapResult() transforms value on success", () => {
    const result = mapResult(ok(2), (x) => x * 2);
    expect(result).toEqual({ ok: true, value: 4 });
  });

  it("mapResult() passes through error unchanged", () => {
    const error = new Error("test");
    const result = err(error);
    const mapped = mapResult(result, () => 99);
    expect(mapped).toBe(result);
  });

  it("unwrapResult() returns value on success", () => {
    const value = unwrapResult(ok(42));
    expect(value).toBe(42);
  });

  it("unwrapResult() throws error on failure", () => {
    const error = new Error("test error");
    expect(() => unwrapResult(err(error))).toThrow(error);
  });
});
