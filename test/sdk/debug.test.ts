import { describe, it, expect } from "vitest";
import { createSolanaReliabilitySdk } from "../../src/sdk/create-sdk.js";
import { isOk, isErr } from "../../src/core/result.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";
import { createFakeTimer } from "../../src/testing/fake-timer.js";
import { createFakeRandom } from "../../src/testing/fake-random.js";

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

describe("Debug Test", () => {
  it("create SDK and send transaction", async () => {
    const fakeClock = createFakeClock();
    const fakeTimer = createFakeTimer();
    const fakeRandom = createFakeRandom();
    const endpointId = createEndpointId("https://api.example.com");

    const responses = new Map([
      ["simulateTransaction", { success: { value: { logs: [], err: null } } }],
      ["sendTransaction", { success: "test-signature-1" }],
    ]);

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.example.com",
      endpointId,
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
        transports: new Map([[endpointId, fakeTransport]]),
      },
    );

    console.log("SDK creation result:", sdkResult);
    if (!sdkResult.ok) {
      console.error("SDK error:", sdkResult.error);
    }

    expect(sdkResult.ok).toBe(true);
    const sdk = sdkResult.value;

    const base64 = encodeTransaction(1);
    const result = await sdk.sendTransaction(base64, "test-blockhash", 100);

    console.log("Send transaction result:", result);
    if (!result.ok) {
      console.error("Send error:", result.error);
    }

    expect(result.ok).toBe(true);
  });
});
