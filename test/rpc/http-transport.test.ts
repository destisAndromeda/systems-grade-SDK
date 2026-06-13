/**
 * Tests for HTTP RPC transport.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHttpRpcTransport } from "../../src/rpc/http-transport.js";
import { createSdkError } from "../../src/core/error.js";

describe("createHttpRpcTransport", () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends correct JSON-RPC 2.0 envelope and returns result", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: 42 }),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    const result = await transport.send("getBalance", { address: "test" });

    expect(result).toBe(42);
    expect(fetchStub).toHaveBeenCalledWith(
      "https://api.solana.com",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );

    const call = fetchStub.mock.calls[0];
    const body = JSON.parse(call![1]!.body as string);
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: { address: "test" },
    });
  });

  it("throws RateLimited on HTTP 429", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({}),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "RateLimited",
      retryable: true,
    });
  });

  it("throws Unknown (non-retryable) on HTTP 401", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "Unknown",
      retryable: false,
    });
  });

  it("throws NetworkError (retryable) on HTTP 503", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({}),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "NetworkError",
      retryable: true,
    });
  });

  it("throws InvalidResponse on non-JSON body", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 200,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "InvalidResponse",
      retryable: false,
    });
  });

  it("throws InvalidResponse on JSON-RPC error with unknown code", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -99999, message: "Unknown error" },
      }),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "InvalidResponse",
      retryable: false,
    });
  });

  it("throws NetworkError (retryable) on JSON-RPC error code -32005", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32005, message: "Resource not available" },
      }),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "NetworkError",
      retryable: true,
    });
  });

  it("throws Timeout (retryable) when fetch throws AbortError", async () => {
    const abortErr = new Error("Aborted");
    (abortErr as any).name = "AbortError";
    fetchStub.mockRejectedValueOnce(abortErr);

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(
      transport.send("getBalance", {}, { timeoutMs: 100 }),
    ).rejects.toMatchObject({
      kind: "Timeout",
      retryable: true,
    });
  });

  it("throws NetworkError when fetch throws a generic network error", async () => {
    const networkError = new Error("ECONNREFUSED");
    fetchStub.mockRejectedValueOnce(networkError);

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await expect(transport.send("getBalance", {})).rejects.toMatchObject({
      kind: "NetworkError",
    });
  });

  it("passes custom headers in every request", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: 42 }),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      headers: { Authorization: "Bearer token123", "X-Custom": "value" },
    });

    await transport.send("getBalance", {});

    const call = fetchStub.mock.calls[0];
    const headers = call![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token123");
    expect(headers["X-Custom"]).toBe("value");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("includes Content-Type: application/json always", async () => {
    fetchStub.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: 42 }),
    });

    const transport = createHttpRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
    });

    await transport.send("getBalance", {});

    const call = fetchStub.mock.calls[0];
    const headers = call![1]!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
