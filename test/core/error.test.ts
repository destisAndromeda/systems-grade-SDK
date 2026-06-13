/**
 * Tests for error types and utilities.
 */

import { describe, it } from "vitest";
import { createSdkError, isRetryableSdkError } from "../../src/core/error.js";

describe("createSdkError", () => {
  it("creates an error with correct kind and message", () => {
    // TODO: assert error.kind === "Timeout" and error.message includes text
  });

  it("sets retryable=true for Timeout by default", () => {
    // TODO: assert createSdkError("Timeout", "...").retryable === true
  });

  it("sets retryable=true for NetworkError by default", () => {
    // TODO: assert createSdkError("NetworkError", "...").retryable === true
  });

  it("respects explicit retryable override", () => {
    // TODO: assert createSdkError("Unknown", "...", { retryable: true }).retryable === true
  });
});

describe("isRetryableSdkError", () => {
  it("returns true for retryable errors", () => {
    // TODO: assert isRetryableSdkError(createSdkError("Timeout", "...")) === true
  });

  it("returns false for non-retryable errors", () => {
    // TODO: assert isRetryableSdkError(createSdkError("InvalidConfig", "...")) === false
  });

  it("handles undefined retryable field with default false", () => {
    // TODO: create error with retryable undefined, assert returns false
  });
});
