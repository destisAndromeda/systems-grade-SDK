/**
 * Tests for Jito relay client.
 */

import { describe, it, expect } from "vitest";
import { createJitoRelayClient } from "../../src/relay/jito.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";

const validBase64 = Buffer.from("tx").toString("base64");

describe("createJitoRelayClient", () => {
  it("creates a relay client named 'jito' by default", () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);

    expect(relay.name).toBe("jito");
  });

  it("supports custom relay name", () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport, { name: "custom-jito" });

    expect(relay.name).toBe("custom-jito");
  });

  it("calls sendTransaction by default", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    await relay.sendTransaction(validBase64);

    const calls = transport.getCalls();
    expect(calls.length).toBe(1);
    const firstCall = calls[0];
    if (firstCall) {
      expect(firstCall.method).toBe("sendTransaction");
    }
  });

  it("calls sendBundle when configured", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendBundle", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport, { method: "sendBundle" });
    await relay.sendTransaction(validBase64);

    const calls = transport.getCalls();
    expect(calls.length).toBe(1);
    const firstCall = calls[0];
    if (firstCall) {
      expect(firstCall.method).toBe("sendBundle");
    }
  });

  it("passes base64 transaction to transport", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    await relay.sendTransaction(validBase64);

    const calls = transport.getCalls();
    expect(calls.length).toBeGreaterThan(0);
    const firstCall = calls[0];
    if (firstCall && firstCall.params) {
      // For sendTransaction, params is [base64, {...}]
      const params = firstCall.params as unknown[];
      expect(Array.isArray(params)).toBe(true);
      if (Array.isArray(params)) {
        expect(params[0]).toBe(validBase64);
      }
    }
  });

  it("parses string signature response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "string-sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result.signature).toBe("string-sig");
  });

  it("parses { result: signature } response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: { result: "result-sig" } }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result.signature).toBe("result-sig");
  });

  it("parses { signature: signature } response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: { signature: "obj-sig" } }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result.signature).toBe("obj-sig");
  });

  it("throws InvalidResponse for empty signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "" }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
      if (isKindOfSdkError(error)) {
        expect(error.kind).toBe("InvalidResponse");
      }
    }
  });

  it("throws InvalidResponse for whitespace-only signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "   " }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
      if (isKindOfSdkError(error)) {
        expect(error.kind).toBe("InvalidResponse");
      }
    }
  });

  it("throws InvalidResponse for malformed response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: { invalidField: "value" } }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
      if (isKindOfSdkError(error)) {
        expect(error.kind).toBe("InvalidResponse");
      }
    }
  });

  it("throws transport SDK error as-is", async () => {
    const sdkError = createSdkError("NetworkError", "Transport failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { error: sdkError }]]),
    });

    const relay = createJitoRelayClient(transport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(error).toBe(sdkError);
    }
  });

  it("maps unknown thrown transport error", async () => {
    // We need a transport that throws an unknown error
    const throwingTransport = {
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      async send() {
        throw new Error("Unknown transport error");
      },
    };

    const relay = createJitoRelayClient(throwingTransport);

    try {
      await relay.sendTransaction(validBase64);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(isKindOfSdkError(error)).toBe(true);
    }
  });

  it("does not throw - throws are for internal relay behavior", async () => {
    // This test documents that throws are internal to the relay client
    // Callers should expect throws, not Result errors
    const transport = createFakeRpcTransport({
      endpointUrl: "https://jito.test",
      endpointId: "jito",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const relay = createJitoRelayClient(transport);
    const result = await relay.sendTransaction(validBase64);

    expect(result).toBeDefined();
    expect(result.signature).toBeDefined();
  });
});

