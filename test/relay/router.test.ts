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
  });
});

