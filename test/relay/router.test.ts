/**
 * Tests for relay routing.
 */

import { describe, it, expect } from "vitest";
import { routeTransaction } from "../../src/relay/router.js";
import { createFakeRelayClient } from "../../src/testing/fake-relay.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { buildPreparedTransaction } from "../../src/tx/send.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk, isErr } from "../../src/core/result.js";

const validBase64 = Buffer.from("tx").toString("base64");
const blockhash = "blockhash123";
const lastValidBlockHeight = 1000;

describe("routeTransaction", () => {
  describe("relay preferred", () => {
    it("sends through relay when relay succeeds", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }

      const relay = createFakeRelayClient({ name: "test-relay", signature: "relay-sig" });
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.signature).toBe("relay-sig");
        expect(result.value.route).toBe("relay");
        expect(result.value.relayName).toBe("test-relay");
      }
    });

    it("returns route 'relay' when relay succeeds", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient();
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.route).toBe("relay");
      }
    });

    it("includes relay name in result", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient({ name: "custom-relay" });
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.relayName).toBe("custom-relay");
      }
    });

    it("does not call RPC when relay succeeds", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient();
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { error: createSdkError("NetworkError", "RPC would fail") }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isOk(result)).toBe(true);
      expect(rpc.callCount()).toBe(0);
    });

    it("passes transaction base64 to relay", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient();
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      await routeTransaction(prepared.value, relay, rpc, {
        preferRelay: true,
        fallbackToRpc: true,
      });

      const calls = relay.getCalls();
      expect(calls.length).toBe(1);
      const firstCall = calls[0];
      if (firstCall) {
        expect(firstCall.base64).toBe(validBase64);
      }
    });

    it("falls back to RPC when relay fails and fallbackToRpc is true", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient({
        error: createSdkError("NetworkError", "Relay unreachable"),
      });
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.signature).toBe("rpc-sig");
        expect(result.value.route).toBe("rpc");
        expect(result.value.endpointId).toBe("rpc-test");
      }
    });

    it("returns relay error when relay fails and fallbackToRpc is false", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient({
        error: createSdkError("NetworkError", "Relay unreachable"),
      });
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: false },
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe("NetworkError");
        expect(result.error.message).toContain("Relay unreachable");
      }
    });

    it("returns RPC error when relay fails and fallback RPC also fails", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient({
        error: createSdkError("NetworkError", "Relay unreachable"),
      });
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { error: createSdkError("NetworkError", "RPC also failed") }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe("NetworkError");
        expect(result.error.message).toContain("RPC also failed");
      }
    });

    it("returns relay Unknown error when relay throws non-SdkError", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient({
        error: new Error("Some random error from relay"),
      });
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: true, fallbackToRpc: false },
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe("Unknown");
        expect(result.error.message).toContain("Relay error:");
      }
    });
  });

  describe("relay not preferred", () => {
    it("sends through RPC directly when preferRelay is false", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient();
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: false, fallbackToRpc: false },
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.signature).toBe("rpc-sig");
        expect(result.value.route).toBe("rpc");
        expect(result.value.endpointId).toBe("rpc-test");
      }
      // Verify relay was never called
      expect(relay.getCalls().length).toBe(0);
    });

    it("returns RPC error when preferRelay is false and RPC fails", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const relay = createFakeRelayClient();
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { error: createSdkError("NetworkError", "RPC failed") }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        relay,
        rpc,
        { preferRelay: false, fallbackToRpc: false },
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe("NetworkError");
        expect(result.error.message).toContain("RPC failed");
      }
      // Verify relay was never called
      expect(relay.getCalls().length).toBe(0);
    });
  });

  describe("relay missing", () => {
    it("falls back to RPC when relay is undefined and fallbackToRpc is true", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        undefined,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.signature).toBe("rpc-sig");
        expect(result.value.route).toBe("rpc");
        expect(result.value.endpointId).toBe("rpc-test");
      }
    });

    it("returns InvalidConfig error when relay is undefined and fallbackToRpc is false", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
      });

      const result = await routeTransaction(
        prepared.value,
        undefined,
        rpc,
        { preferRelay: true, fallbackToRpc: false },
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe("InvalidConfig");
        expect(result.error.retryable).toBe(false);
        expect(result.error.message).toContain("Relay not provided");
      }
    });

    it("returns RPC error when relay is undefined, fallbackToRpc is true, but RPC fails", async () => {
      const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
      if (!isOk(prepared)) {
        throw new Error("Prepared transaction should be ok");
      }
      const rpc = createFakeRpcTransport({
        endpointUrl: "https://rpc.test",
        endpointId: "rpc-test",
        responses: new Map([["sendTransaction", { error: createSdkError("NetworkError", "RPC failed") }]]),
      });

      const result = await routeTransaction(
        prepared.value,
        undefined,
        rpc,
        { preferRelay: true, fallbackToRpc: true },
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe("NetworkError");
        expect(result.error.message).toContain("RPC failed");
      }
    });
  });
});

