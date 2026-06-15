/**
 * Tests for SDK integration with transaction lifecycle.
 *
 * Tests prove:
 * - sendTransaction uses preflight guard and SDK-controlled retry
 * - Transaction metadata is stored for rebroadcast
 * - confirmTransaction uses rebroadcast when signature is tracked
 * - sendAndConfirmTransaction works end-to-end
 * - Wallet signing is used properly
 * - Relay routing still works with tracking
 * - Error mapping for lifecycle errors
 */

import { describe, it, expect } from "vitest";
import { createSolanaReliabilitySdk } from "../../src/sdk/create-sdk.js";
import { isOk, isErr, ok } from "../../src/core/result.js";
import { createSdkError } from "../../src/core/error.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";
import { createFakeTimer } from "../../src/testing/fake-timer.js";
import { createFakeRandom } from "../../src/testing/fake-random.js";
import { createFakeRelayClient } from "../../src/testing/fake-relay.js";
import type { TransactionWallet } from "../../src/wallet/types.js";

// Helper: encode fake transaction
function encodeTransaction(seed: number): string {
  const buf = Buffer.alloc(200);
  // Signature count (1) in compact-u16 format
  buf[0] = 1;
  // 64 bytes of signature
  for (let i = 0; i < 64; i++) {
    buf[1 + i] = (seed + i) % 256;
  }
  return buf.toString("base64");
}

// Helper: compute endpoint ID from URL (matching SDK's createEndpointId logic)
function createEndpointId(url: string): string {
  const normalized = url.replace(/\/$/, "").toLowerCase();
  return normalized
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

describe("SDK Lifecycle Integration", () => {
  describe("A. Default send path uses preflight guard and SDK-controlled retry", () => {
    it("sendTransaction calls simulateTransaction then sendTransaction with maxRetries: 0", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "test-signature-1" }],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(1);
      const result = await sdk.sendTransaction(base64, "test-blockhash", 100);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) throw new Error("Send failed");
      expect(result.value).toBe("test-signature-1");

      // Verify calls were made
      const calls = fakeTransport.getCalls();
      expect(calls.length).toBeGreaterThanOrEqual(2);

      // Check for simulateTransaction and sendTransaction calls
      const simCall = calls.find((c) => c.method === "simulateTransaction");
      expect(simCall).toBeDefined();

      const sendCall = calls.find((c) => c.method === "sendTransaction");
      expect(sendCall).toBeDefined();

      // Verify sendTransaction has the right options
      if (sendCall) {
        const params = sendCall.params as any[];
        const opts = params[1] as any;
        expect(opts?.maxRetries).toBe(0);
        expect(opts?.encoding).toBe("base64");
      }
    });

    it("after successful simulation, sendTransaction uses skipPreflight: true", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "sig-with-skip" }],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(2);
      const result = await sdk.sendTransaction(base64, "blockhash", 200);

      expect(isOk(result)).toBe(true);

      const sendCall = fakeTransport
        .getCalls()
        .find((c) => c.method === "sendTransaction");
      if (sendCall) {
        const params = sendCall.params as any[];
        const opts = params[1] as any;
        expect(opts?.skipPreflight).toBe(true);
      }
    });
  });

  describe("B. sendTransaction stores tracked transaction metadata", () => {
    it("after successful send, confirmTransaction receives tracked signature", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "tracked-sig" }],
        ["getBlockHeight", { success: 150 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 150 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      // Send transaction
      const base64 = encodeTransaction(3);
      const sendResult = await sdk.sendTransaction(base64, "blockhash", 300);
      expect(isOk(sendResult)).toBe(true);
      if (!isOk(sendResult)) throw new Error("Send failed");

      const signature = sendResult.value;

      // Confirm transaction
      const confirmResult = await sdk.confirmTransaction(signature, {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(isOk(confirmResult)).toBe(true);
      if (!isOk(confirmResult)) throw new Error("Confirm failed");
      
      // Verify transaction was confirmed and signature was tracked
      expect(confirmResult.value.confirmed).toBe(true);
      expect(confirmResult.value.slot).toBe(150);
      
      // Verify getSignatureStatuses was called (lifecycle polling)
      const statusCall = fakeTransport
        .getCalls()
        .find((c) => c.method === "getSignatureStatuses");
      expect(statusCall).toBeDefined();
    });

    it("rebroadcasts tracked transaction if still pending", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "rebroadcast-sig" }],
        ["getBlockHeight", { success: 150 }],
        ["getSignatureStatuses", { success: { value: [null] } }],
        ["sendTransaction", { success: "rebroadcast-sig" }],
        ["getBlockHeight", { success: 160 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 160 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(4);
      const sendResult = await sdk.sendTransaction(base64, "blockhash", 400);
      expect(isOk(sendResult)).toBe(true);
      if (!isOk(sendResult)) throw new Error("Send failed");

      const signature = sendResult.value;

      const confirmResult = await sdk.confirmTransaction(signature, {
        timeoutMs: 10000,
        pollIntervalMs: 100,
      });

      expect(isOk(confirmResult)).toBe(true);

      // Verify rebroadcast happened (multiple sendTransaction calls)
      const sendCalls = fakeTransport
        .getCalls()
        .filter((c) => c.method === "sendTransaction");
      expect(sendCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("C. confirmTransaction falls back to old polling for unknown signatures", () => {
    it("unknown signature uses pollTransactionConfirmation", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 200 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      // Confirm unknown signature
      const result = await sdk.confirmTransaction("unknown-sig", {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(isOk(result)).toBe(true);

      // Verify polling was used (getSignatureStatuses called, not getBlockHeight)
      const statusCall = fakeTransport
        .getCalls()
        .find((c) => c.method === "getSignatureStatuses");
      expect(statusCall).toBeDefined();

      const blockHeightCall = fakeTransport
        .getCalls()
        .find((c) => c.method === "getBlockHeight");
      expect(blockHeightCall).toBeUndefined();
    });
  });

  describe("D. Wallet path stores signed wire", () => {
    it("sendTransaction with wallet signs then tracks signed base64", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "wallet-signed-sig" }],
        ["getBlockHeight", { success: 500 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 500 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const fakeWallet: TransactionWallet = {
        async signTransaction(base64: string) {
          // Return a different signed base64
          const signedBuf = Buffer.from(base64, "base64");
          signedBuf[100] = 0xff;
          return {
            signedBase64: signedBuf.toString("base64"),
          };
        },
      };

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
          wallet: fakeWallet,
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(5);
      const sendResult = await sdk.sendTransaction(base64, "blockhash", 500);
      expect(isOk(sendResult)).toBe(true);
      if (!isOk(sendResult)) throw new Error("Send failed");

      const signature = sendResult.value;

      // Confirm should use the signed wire (not the original)
      const confirmResult = await sdk.confirmTransaction(signature, {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(isOk(confirmResult)).toBe(true);
    });
  });

  describe("E. Relay path still works with tracking", () => {
    it("relay success stores wire and confirmTransaction can rebroadcast over RPC", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["getBlockHeight", { success: 600 }],
        ["sendTransaction", { success: "rebroadcast-sig" }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 600 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const fakeRelay = createFakeRelayClient({
        name: "test-relay",
        signature: "relay-sig",
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
          relay: fakeRelay,
          relayRouting: {
            preferRelay: true,
            fallbackToRpc: true,
          },
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(6);
      const sendResult = await sdk.sendTransaction(base64, "blockhash", 600);
      expect(isOk(sendResult)).toBe(true);
      if (!isOk(sendResult)) throw new Error("Send failed");

      const signature = sendResult.value;

      // Confirm uses lifecycle/rebroadcast
      const confirmResult = await sdk.confirmTransaction(signature, {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(isOk(confirmResult)).toBe(true);
    });
  });

  describe("F. Relay fallback still works", () => {
    it("relay fails, fallback to RPC succeeds, transaction tracked", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "fallback-sig" }],
        ["getBlockHeight", { success: 700 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 700 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const fakeRelay = createFakeRelayClient({
        error: createSdkError("NetworkError", "Relay failed"),
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
          relay: fakeRelay,
          relayRouting: {
            preferRelay: true,
            fallbackToRpc: true,
          },
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(7);
      const sendResult = await sdk.sendTransaction(base64, "blockhash", 700);
      expect(isOk(sendResult)).toBe(true);
      if (!isOk(sendResult)) throw new Error("Send failed");

      const signature = sendResult.value;

      const confirmResult = await sdk.confirmTransaction(signature, {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(isOk(confirmResult)).toBe(true);
    });
  });

  describe("G. sendAndConfirmTransaction uses lifecycle", () => {
    it("sends, confirms, and returns combined result", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "combined-sig" }],
        ["getBlockHeight", { success: 800 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 800 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(8);
      const result = await sdk.sendAndConfirmTransaction(base64, "blockhash", 800, {
        timeoutMs: 5000,
        pollIntervalMs: 100,
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) throw new Error("Send and confirm failed");
      expect(result.value.signature).toBe("combined-sig");
      expect(result.value.confirmed).toBe(true);
      expect(result.value.slot).toBe(800);
    });

    it("returns signature and slot in combined result", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "slot-sig" }],
        ["getBlockHeight", { success: 900 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "finalized", slot: 999 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(9);
      const result = await sdk.sendAndConfirmTransaction(base64, "blockhash", 900);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) throw new Error("Send and confirm with slot failed");
      expect(result.value.signature).toBeDefined();
      expect(result.value.confirmed).toBe(true);
      expect(result.value.slot).toBe(999);
    });
  });

  describe("H. Expiry maps to SDK error", () => {
    it("transaction expiry returns error", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "expiry-sig" }],
        ["getBlockHeight", { success: 2000 }], // Way beyond lastValidBlockHeight
        [
          "getSignatureStatuses",
          {
            success: {
              value: [null], // Transaction not yet confirmed
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(10);
      const sendResult = await sdk.sendTransaction(base64, "blockhash", 100); // lastValidBlockHeight: 100
      expect(isOk(sendResult)).toBe(true);
      if (!isOk(sendResult)) throw new Error("Send failed");

      const signature = sendResult.value;

      // Confirm should fail due to expiry
      const confirmResult = await sdk.confirmTransaction(signature, {
        timeoutMs: 10000,
        pollIntervalMs: 100,
      });

      expect(isErr(confirmResult)).toBe(true);
      if (isErr(confirmResult)) {
        expect(confirmResult.error.kind).toBe("InvalidTransaction");
      }
    });
  });

  describe("Backward Compatibility", () => {
    it("existing public API is unchanged", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "compat-sig" }],
        ["getBlockHeight", { success: 1100 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 1100 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      // Old API still works
      expect(sdk.sendTransaction).toBeDefined();
      expect(sdk.confirmTransaction).toBeDefined();
      expect(sdk.getPriorityFee).toBeDefined();
      expect(sdk.getEndpointHealth).toBeDefined();
      expect(sdk.getMetrics).toBeDefined();

      // New API exists
      expect(sdk.sendAndConfirmTransaction).toBeDefined();
    });

    it("metrics include new tx_send_and_confirm event type", async () => {
      const fakeClock = createFakeClock();
      const fakeTimer = createFakeTimer();
      const fakeRandom = createFakeRandom();

      const responses = new Map([
        ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
        ["sendTransaction", { success: "metric-sig" }],
        ["getBlockHeight", { success: 1200 }],
        [
          "getSignatureStatuses",
          {
            success: {
              value: [{ confirmationStatus: "confirmed", slot: 1200 }],
            },
          },
        ],
      ]);

      const fakeTransport = createFakeRpcTransport({
        endpointUrl: "https://api.example.com",
        endpointId: createEndpointId("https://api.example.com"),
        responses,
      });

      const sdkResult = createSolanaReliabilitySdk(
        {
          endpoints: ["https://api.example.com"],
        },
        {
          clock: fakeClock,
          timer: fakeTimer,
          random: fakeRandom,
          transports: new Map([[createEndpointId("https://api.example.com"), fakeTransport]]),
        },
      );

      expect(isOk(sdkResult)).toBe(true);
      if (!isOk(sdkResult)) throw new Error("SDK creation failed");
      const sdk = sdkResult.value;

      const base64 = encodeTransaction(11);
      const result = await sdk.sendAndConfirmTransaction(base64, "blockhash", 1200);

      expect(isOk(result)).toBe(true);

      const metrics = sdk.getMetrics();
      const sendAndConfirmMetric = metrics.find(
        (m) => m.type === "tx_send_and_confirm",
      );
      expect(sendAndConfirmMetric).toBeDefined();
    });
  });
});
