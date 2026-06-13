/**
 * Tests for error types and utilities.
 */

import { describe, it, expect } from "vitest";
import { createSdkError, isRetryableSdkError, mapToSdkError } from "../../src/core/error.js";

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

describe("mapToSdkError", () => {
  it("returns existing SdkError unchanged", () => {
    const error = createSdkError("Timeout", "Request timed out");
    const mapped = mapToSdkError(error);
    expect(mapped).toBe(error);
  });

  it("maps regular Error to SdkError", () => {
    const error = new Error("Something went wrong");
    const mapped = mapToSdkError(error);
    expect(mapped.kind).toBe("Unknown");
    expect(mapped.message).toBe("Something went wrong");
    expect(mapped.cause).toBe(error);
  });

  it("maps string to SdkError with message", () => {
    const mapped = mapToSdkError("boom");
    expect(mapped.kind).toBe("Unknown");
    expect(mapped.message).toBe("boom");
  });

  it("maps unknown object to SdkError", () => {
    const obj = { foo: "bar" };
    const mapped = mapToSdkError(obj);
    expect(mapped.kind).toBe("Unknown");
    expect(typeof mapped.message).toBe("string");
    expect(mapped.cause).toBe(obj);
  });

  it("respects custom fallback kind", () => {
    const error = new Error("Network issue");
    const mapped = mapToSdkError(error, "NetworkError");
    expect(mapped.kind).toBe("NetworkError");
    expect(mapped.message).toBe("Network issue");
  });

  it("defaults to Unknown when no fallback kind provided", () => {
    const mapped = mapToSdkError(null);
    expect(mapped.kind).toBe("Unknown");
  });
});
