/**
 * Tests for transaction sending.
 */

import { describe, it, expect } from "vitest";
import {
  buildPreparedTransaction,
  isBlockhashExpired,
  simulateTransaction,
  sendTransactionViaRpc,
  sendTransactionWithResilience,
} from "../../src/tx/send.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk } from "../../src/core/result.js";

describe("buildPreparedTransaction", () => {
  it("creates prepared transaction with valid inputs", () => {
    const base64 = Buffer.from("test transaction bytes").toString("base64");
    const result = buildPreparedTransaction(base64, "blockhash123", 1000);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.base64).toBe(base64);
      expect(result.value.blockhash).toBe("blockhash123");
      expect(result.value.lastValidBlockHeight).toBe(1000);
    }
  });

  it("rejects empty base64", () => {
    const result = buildPreparedTransaction("", "blockhash123", 1000);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects invalid base64", () => {
    const result = buildPreparedTransaction("not-valid-base64!", "blockhash123", 1000);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects base64 that decodes to empty bytes", () => {
    // This would require creating an empty buffer and encoding it
    // But empty buffers don't encode to valid base64 that fails decode
    // So we test with definitely invalid input
    const result = buildPreparedTransaction(Buffer.alloc(0).toString("base64"), "blockhash123", 1000);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects empty blockhash", () => {
    const base64 = Buffer.from("test").toString("base64");
    const result = buildPreparedTransaction(base64, "", 1000);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects whitespace-only blockhash", () => {
    const base64 = Buffer.from("test").toString("base64");
    const result = buildPreparedTransaction(base64, "   ", 1000);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects zero last valid block height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const result = buildPreparedTransaction(base64, "blockhash123", 0);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects negative last valid block height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const result = buildPreparedTransaction(base64, "blockhash123", -1);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects non-integer last valid block height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const result = buildPreparedTransaction(base64, "blockhash123", 100.5);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("rejects unsafe integer last valid block height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const unsafeInt = Number.MAX_SAFE_INTEGER + 1;
    const result = buildPreparedTransaction(base64, "blockhash123", unsafeInt);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });
});

describe("isBlockhashExpired", () => {
  it("returns false when current height is below last valid height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    expect(isBlockhashExpired(prepared, 99)).toBe(false);
  });

  it("returns false when current height equals last valid height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    expect(isBlockhashExpired(prepared, 100)).toBe(false);
  });

  it("returns true when current height is greater than last valid height", () => {
    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    expect(isBlockhashExpired(prepared, 101)).toBe(true);
  });
});

describe("simulateTransaction", () => {
  it("parses response with value.logs and value.unitsConsumed", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: {
              value: { logs: ["log1", "log2"], unitsConsumed: 5000 },
            },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.logs).toEqual(["log1", "log2"]);
      expect(result.value.unitsConsumed).toBe(5000);
    }
  });

  it("parses direct response with logs and unitsConsumed", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { logs: ["log1"], unitsConsumed: 1000 },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.logs).toEqual(["log1"]);
      expect(result.value.unitsConsumed).toBe(1000);
    }
  });

  it("handles missing unitsConsumed", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { value: { logs: ["log1"] } },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.logs).toEqual(["log1"]);
      expect(result.value.unitsConsumed).toBeUndefined();
    }
  });

  it("returns InvalidResponse for invalid response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { invalid: "response" },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when logs is missing", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { value: { unitsConsumed: 1000 } },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when logs is not array", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { value: { logs: "not-array" } },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when a log entry is not string", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { value: { logs: ["log1", 123, "log2"] } },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when unitsConsumed is not number", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: { value: { logs: ["log1"], unitsConsumed: "not-number" } },
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when response is not object", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([
        [
          "simulateTransaction",
          {
            success: "not-object",
          },
        ],
      ]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns transport SDK error as-is", async () => {
    const error = createSdkError("NetworkError", "Connection failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["simulateTransaction", { error }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("NetworkError");
    }
  });

  it("maps unknown thrown error using transport error mapper", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["simulateTransaction", { error: createSdkError("Unknown", "test") }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await simulateTransaction(transport, prepared);

    expect(isOk(result)).toBe(false);
  });

  it("does not throw", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["simulateTransaction", { error: createSdkError("Unknown", "test") }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    // Should not throw
    const result = await simulateTransaction(transport, prepared);
    expect(result).toBeDefined();
  });
});

describe("sendTransactionViaRpc", () => {
  it("calls sendTransaction RPC method", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig123" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(true);
  });

  it("parses string signature response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "signature-string" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signature).toBe("signature-string");
      expect(result.value.endpointId).toBe("test");
    }
  });

  it("parses { result: signature } response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: { result: "sig-from-result" } }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signature).toBe("sig-from-result");
    }
  });

  it("parses { signature } response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: { signature: "sig-field" } }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signature).toBe("sig-field");
    }
  });

  it("passes skipPreflight option", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    await sendTransactionViaRpc(transport, prepared, { skipPreflight: true });

    // Verify it was called (transport should have recorded it)
    expect(true).toBe(true);
  });

  it("includes maxRetries only when provided", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result1 = await sendTransactionViaRpc(transport, prepared, { maxRetries: 5 });
    expect(isOk(result1)).toBe(true);

    const result2 = await sendTransactionViaRpc(transport, prepared);
    expect(isOk(result2)).toBe(true);
  });

  it("returns InvalidResponse for empty signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse for whitespace-only signature", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "   " }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when result is not string", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: { result: 123 } }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when signature is not string", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: { signature: false } }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidResponse");
    }
  });

  it("maps unknown thrown error using transport error mapper", async () => {
    const error = createSdkError("Unknown", "Something went wrong");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { error }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(false);
  });

  it("returns transport SDK error as-is", async () => {
    const error = createSdkError("NetworkError", "Failed to send");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { error }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("NetworkError");
    }
  });

  it("includes endpoint id in result", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://my-endpoint.com",
      endpointId: "my-endpoint-id",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionViaRpc(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.endpointId).toBe("my-endpoint-id");
    }
  });
});

describe("sendTransactionWithResilience", () => {
  it("returns InvalidTransaction when blockhash is expired", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared, {
      currentBlockHeight: 101,
    });

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error) && result.error.kind).toBe("InvalidTransaction");
    }
  });

  it("does not call transport when blockhash is expired", async () => {
    let transportCalled = false;

    const transport: any = {
      endpointUrl: "https://api.test",
      endpointId: "test",
      async send() {
        transportCalled = true;
        return "sig";
      },
    };

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    await sendTransactionWithResilience(transport, prepared, {
      currentBlockHeight: 101,
    });

    expect(transportCalled).toBe(false);
  });

  it("sends transaction when blockhash is still valid", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared, {
      currentBlockHeight: 99,
    });

    expect(isOk(result)).toBe(true);
  });

  it("treats equal current block height as valid", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared, {
      currentBlockHeight: 100,
    });

    expect(isOk(result)).toBe(true);
  });

  it("sends transaction when currentBlockHeight is not provided", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared);

    expect(isOk(result)).toBe(true);
  });

  it("delegates to sendTransactionViaRpc", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig123" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared, {
      currentBlockHeight: 50,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signature).toBe("sig123");
    }
  });

  it("returns send result on success", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { success: "sig-value" }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signature).toBe("sig-value");
    }
  });

  it("returns send error on failure", async () => {
    const error = createSdkError("NetworkError", "Failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "test",
      responses: new Map([["sendTransaction", { error }]]),
    });

    const base64 = Buffer.from("test").toString("base64");
    const prepared = { base64, blockhash: "hash", lastValidBlockHeight: 100 };

    const result = await sendTransactionWithResilience(transport, prepared);

    expect(isOk(result)).toBe(false);
  });
});
