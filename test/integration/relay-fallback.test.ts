/**
 * Integration test: Relay fallback to RPC.
 *
 * Verifies that transactions can be routed through relay first,
 * then fall back to standard RPC if relay fails.
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

describe("Relay Fallback to RPC", () => {
  it("relay success skips rpc", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const relay = createFakeRelayClient({ name: "relay", signature: "relay-sig" });
    const rpc = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
    });

    const result = await routeTransaction(prepared.value, relay, rpc, {
      preferRelay: true,
      fallbackToRpc: true,
    });

    // Assert result route is "relay"
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.route).toBe("relay");
    }

    // Assert relay was called once
    expect(relay.callCount()).toBe(1);

    // Assert RPC was not called
    expect(rpc.callCount()).toBe(0);
  });

  it("relay failure falls back to rpc", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const relayError = createSdkError("NetworkError", "Relay timeout");
    const relay = createFakeRelayClient({ error: relayError });

    const rpc = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
    });

    const result = await routeTransaction(prepared.value, relay, rpc, {
      preferRelay: true,
      fallbackToRpc: true,
    });

    // Assert result route is "rpc"
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.route).toBe("rpc");
    }

    // Assert relay called once
    expect(relay.callCount()).toBe(1);

    // Assert RPC called once
    expect(rpc.callCount()).toBe(1);
  });

  it("relay failure without fallback returns relay error", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const relayError = createSdkError("NetworkError", "Relay timeout");
    const relay = createFakeRelayClient({ error: relayError });

    const rpc = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
    });

    const result = await routeTransaction(prepared.value, relay, rpc, {
      preferRelay: true,
      fallbackToRpc: false,
    });

    // Assert result is err with NetworkError
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("NetworkError");
      }
    }

    // Assert RPC was not called
    expect(rpc.callCount()).toBe(0);
  });

  it("rpc direct path works when relay is not preferred", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const relay = createFakeRelayClient({ signature: "relay-sig" });
    const rpc = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "rpc-sig" }]]),
    });

    const result = await routeTransaction(prepared.value, relay, rpc, {
      preferRelay: false,
      fallbackToRpc: true,
    });

    // Assert result route is "rpc"
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.route).toBe("rpc");
    }

    // Assert relay was not called
    expect(relay.callCount()).toBe(0);

    // Assert RPC was called once
    expect(rpc.callCount()).toBe(1);
  });
});

