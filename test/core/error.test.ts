/**
 * Tests for error types and utilities.
 */

import { describe, it, expect } from "vitest";
import { createSdkError, isRetryableSdkError } from "../../src/core/error.js";

describe("createSdkError", () => {
  it("creates an error with correct kind and message", () => {
    const error = createSdkError("Timeout", "Request timed out");
    expect(error.kind).toBe("Timeout");
    expect(error.message).toBe("Request timed out");
    expect(error.name).toBe("SdkError[Timeout]");
  });

  it("sets retryable=true for Timeout by default", () => {
    const error = createSdkError("Timeout", "Request timed out");
    expect(error.retryable).toBe(true);
  });

  it("sets retryable=true for NetworkError by default", () => {
    const error = createSdkError("NetworkError", "Network failed");
    expect(error.retryable).toBe(true);
  });

  it("sets retryable=true for RateLimited by default", () => {
    const error = createSdkError("RateLimited", "Too many requests");
    expect(error.retryable).toBe(true);
  });

  it("sets retryable=false for non-retryable errors by default", () => {
    const error = createSdkError("InvalidConfig", "Bad config");
    expect(error.retryable).toBe(false);
  });

  it("respects explicit retryable override", () => {
    const error = createSdkError("Unknown", "Something", { retryable: true });
    expect(error.retryable).toBe(true);
  });

  it("respects explicit retryable=false override", () => {
    const error = createSdkError("Timeout", "Timeout", { retryable: false });
    expect(error.retryable).toBe(false);
  });

  it("includes cause when provided", () => {
    const cause = new Error("underlying");
    const error = createSdkError("NetworkError", "Network failed", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("isRetryableSdkError", () => {
  it("returns true for retryable errors", () => {
    const error = createSdkError("Timeout", "Timeout");
    expect(isRetryableSdkError(error)).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    const error = createSdkError("InvalidConfig", "Bad config");
    expect(isRetryableSdkError(error)).toBe(false);
  });

  it("handles false retryable field", () => {
    const error = createSdkError("Unknown", "Unknown", { retryable: false });
    expect(isRetryableSdkError(error)).toBe(false);
  });
});
