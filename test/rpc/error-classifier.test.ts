/**
 * Tests for error classification and endpoint fault detection.
 */

import { describe, it, expect } from "vitest";
import { classifyError, isEndpointFault, ErrorClass } from "../../src/rpc/error-classifier.js";

describe("classifyError", () => {
  describe("RpcError classification", () => {
    it("classifies object with numeric code and message as RpcError", () => {
      const error = { code: -32600, message: "Invalid Request" };
      expect(classifyError(error)).toBe(ErrorClass.RpcError);
    });

    it("classifies object with string code and message as RpcError", () => {
      const error = { code: "INVALID_METHOD", message: "Method not found" };
      expect(classifyError(error)).toBe(ErrorClass.RpcError);
    });

    it("classifies JSON-RPC 2.0 error format as RpcError", () => {
      const error = {
        code: -32700,
        message: "Parse error",
        data: "Some data",
      };
      expect(classifyError(error)).toBe(ErrorClass.RpcError);
    });

    it("classifies error with negative error code as RpcError", () => {
      const error = { code: -32000, message: "Server error" };
      expect(classifyError(error)).toBe(ErrorClass.RpcError);
    });

    it("does not classify object without code as RpcError", () => {
      const error = { message: "Some error" };
      expect(classifyError(error)).not.toBe(ErrorClass.RpcError);
    });

    it("does not classify object without message as RpcError", () => {
      const error = { code: 123 };
      expect(classifyError(error)).not.toBe(ErrorClass.RpcError);
    });

    it("does not classify HTTP status codes as RpcError", () => {
      const error429 = { code: 429, message: "Too Many Requests" };
      const error500 = { code: 500, message: "Internal Server Error" };
      expect(classifyError(error429)).not.toBe(ErrorClass.RpcError);
      expect(classifyError(error500)).not.toBe(ErrorClass.RpcError);
    });
  });

  describe("Timeout classification", () => {
    it("classifies AbortError as Timeout", () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      expect(classifyError(error)).toBe(ErrorClass.Timeout);
    });

    it("classifies error with 'timeout' in message as Timeout", () => {
      const error = new Error("Request timeout");
      expect(classifyError(error)).toBe(ErrorClass.Timeout);
    });

    it("classifies error with 'timed out' in message as Timeout", () => {
      const error = new Error("Request timed out");
      expect(classifyError(error)).toBe(ErrorClass.Timeout);
    });

    it("classifies error with 'Timeout' (uppercase) in message as Timeout", () => {
      const error = new Error("Request Timeout");
      expect(classifyError(error)).toBe(ErrorClass.Timeout);
    });
  });

  describe("RateLimited classification", () => {
    it("classifies error with code 429 as RateLimited (HTTP status)", () => {
      const error = { code: 429, message: "Too Many Requests" };
      expect(classifyError(error)).toBe(ErrorClass.RateLimited);
    });

    it("classifies error with 'HTTP 429' in message as RateLimited", () => {
      const error = new Error("HTTP 429: Too Many Requests");
      expect(classifyError(error)).toBe(ErrorClass.RateLimited);
    });

    it("classifies error with '429' in message as RateLimited", () => {
      const error = new Error("Status 429");
      expect(classifyError(error)).toBe(ErrorClass.RateLimited);
    });

    it("classifies error with 'rate limit' in message as RateLimited", () => {
      const error = new Error("You have hit the rate limit");
      expect(classifyError(error)).toBe(ErrorClass.RateLimited);
    });

    it("classifies error with 'too many requests' in message as RateLimited", () => {
      const error = new Error("Too many requests");
      expect(classifyError(error)).toBe(ErrorClass.RateLimited);
    });
  });

  describe("ServerError classification", () => {
    it("classifies error with 'HTTP 500' in message as ServerError", () => {
      const error = new Error("HTTP 500: Internal Server Error");
      expect(classifyError(error)).toBe(ErrorClass.ServerError);
    });

    it("classifies error with 'HTTP 503' in message as ServerError", () => {
      const error = new Error("HTTP 503: Service Unavailable");
      expect(classifyError(error)).toBe(ErrorClass.ServerError);
    });

    it("classifies error with code 500 as ServerError (HTTP status)", () => {
      const error = { code: 500, message: "Internal Server Error" };
      expect(classifyError(error)).toBe(ErrorClass.ServerError);
    });

    it("classifies error with code 503 as ServerError (HTTP status)", () => {
      const error = { code: 503, message: "Service Unavailable" };
      expect(classifyError(error)).toBe(ErrorClass.ServerError);
    });

    it("classifies error with 'internal server error' in message as ServerError", () => {
      const error = new Error("Internal server error");
      expect(classifyError(error)).toBe(ErrorClass.ServerError);
    });

    it("classifies error with 'service unavailable' in message as ServerError", () => {
      const error = new Error("Service unavailable");
      expect(classifyError(error)).toBe(ErrorClass.ServerError);
    });
  });

  describe("Network classification", () => {
    it("classifies error with ECONNREFUSED code as Network", () => {
      const error = new Error("Connection refused");
      (error as any).code = "ECONNREFUSED";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with ECONNRESET code as Network", () => {
      const error = new Error("Connection reset");
      (error as any).code = "ECONNRESET";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with ENOTFOUND code as Network", () => {
      const error = new Error("Not found");
      (error as any).code = "ENOTFOUND";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with ECONNABORTED code as Network", () => {
      const error = new Error("Connection aborted");
      (error as any).code = "ECONNABORTED";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with EAGAIN code as Network", () => {
      const error = new Error("Try again");
      (error as any).code = "EAGAIN";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with EHOSTUNREACH code as Network", () => {
      const error = new Error("Host unreachable");
      (error as any).code = "EHOSTUNREACH";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with 'fetch failed' in message as Network", () => {
      const error = new Error("Fetch failed");
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with 'network error' in message as Network", () => {
      const error = new Error("Network error");
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with 'socket' in message as Network", () => {
      const error = new Error("Socket error");
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });

    it("classifies error with name ECONNREFUSED as Network", () => {
      const error = new Error("Connection refused");
      error.name = "ECONNREFUSED";
      expect(classifyError(error)).toBe(ErrorClass.Network);
    });
  });

  describe("Unknown classification", () => {
    it("classifies arbitrary error as Unknown", () => {
      const error = new Error("Something unexpected");
      expect(classifyError(error)).toBe(ErrorClass.Unknown);
    });

    it("classifies string as Unknown", () => {
      expect(classifyError("some error")).toBe(ErrorClass.Unknown);
    });

    it("classifies null as Unknown", () => {
      expect(classifyError(null)).toBe(ErrorClass.Unknown);
    });

    it("classifies undefined as Unknown", () => {
      expect(classifyError(undefined)).toBe(ErrorClass.Unknown);
    });

    it("classifies plain object without code/message as Unknown", () => {
      expect(classifyError({ foo: "bar" })).toBe(ErrorClass.Unknown);
    });
  });

  describe("Precedence and edge cases", () => {
    it("classifies negative error codes as RpcError even with specific message", () => {
      const error = {
        code: -32600,
        message: "Invalid Request",
      };
      expect(classifyError(error)).toBe(ErrorClass.RpcError);
    });

    it("classifies error with timeout in message as Timeout even with HTTP pattern", () => {
      const error = new Error("HTTP timeout");
      expect(classifyError(error)).toBe(ErrorClass.Timeout);
    });

    it("handles case-insensitive message matching", () => {
      const error1 = new Error("TIMEOUT");
      const error2 = new Error("TiMeOuT");
      expect(classifyError(error1)).toBe(ErrorClass.Timeout);
      expect(classifyError(error2)).toBe(ErrorClass.Timeout);
    });
  });
});

describe("isEndpointFault", () => {
  it("returns false for RpcError", () => {
    expect(isEndpointFault(ErrorClass.RpcError)).toBe(false);
  });

  it("returns true for Network", () => {
    expect(isEndpointFault(ErrorClass.Network)).toBe(true);
  });

  it("returns true for Timeout", () => {
    expect(isEndpointFault(ErrorClass.Timeout)).toBe(true);
  });

  it("returns true for RateLimited", () => {
    expect(isEndpointFault(ErrorClass.RateLimited)).toBe(true);
  });

  it("returns true for ServerError", () => {
    expect(isEndpointFault(ErrorClass.ServerError)).toBe(true);
  });

  it("returns true for Unknown", () => {
    expect(isEndpointFault(ErrorClass.Unknown)).toBe(true);
  });

  it("only RpcError returns false", () => {
    const allClasses = [
      ErrorClass.Network,
      ErrorClass.Timeout,
      ErrorClass.RateLimited,
      ErrorClass.ServerError,
      ErrorClass.Unknown,
      ErrorClass.RpcError,
    ];

    const faults = allClasses.filter((cls) => isEndpointFault(cls));
    const nonFaults = allClasses.filter((cls) => !isEndpointFault(cls));

    expect(faults).toHaveLength(5);
    expect(nonFaults).toHaveLength(1);
    expect(nonFaults[0]).toBe(ErrorClass.RpcError);
  });
});
