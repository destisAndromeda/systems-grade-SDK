/**
 * Integration test: Metrics export during SDK lifecycle.
 *
 * Verifies that metrics are emitted for transaction operations.
 */

import { describe, it, expect } from "vitest";
import { createSolanaReliabilitySdk } from "../../src/sdk/create-sdk.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { createInMemoryMetricsSink } from "../../src/metrics/memory.js";
import { createOtelMetricsSink } from "../../src/metrics/otel.js";
import { isOk, isErr } from "../../src/core/result.js";

describe("SDK Metrics Export", () => {
  it("records metric when SDK sends transaction successfully", async () => {
    const metricsSink = createInMemoryMetricsSink();
    const endpoint = "https://api.test";
    const endpointId = "https_api_test"; // Matches generated ID from endpoint

    // Create fake transport with sendTransaction response
    const fakeTransport = createFakeRpcTransport({
      endpointUrl: endpoint,
      endpointId,
      responses: new Map([
        ["sendTransaction", { success: "test-signature-123" }],
      ]),
    });

    const transports = new Map([[endpointId, fakeTransport]]);

    const sdkResult = createSolanaReliabilitySdk(
      {
        endpoints: [endpoint],
        metrics: metricsSink,
      },
      { transports },
    );

    expect(isOk(sdkResult)).toBe(true);
    if (isErr(sdkResult)) return;

    const sdk = sdkResult.value;

    // Send transaction
    const sendResult = await sdk.sendTransaction(
      Buffer.from("tx data").toString("base64"),
      "blockhash123",
      1000,
    );

    expect(isOk(sendResult)).toBe(true);

    // Check metrics
    const metrics = sdk.getMetrics();
    const txSendMetrics = metrics.filter((m) => m.type === "tx_send");
    expect(txSendMetrics.length).toBeGreaterThan(0);
  });

  it("records metric when SDK confirms transaction successfully", async () => {
    const metricsSink = createInMemoryMetricsSink();
    const endpoint = "https://api.test";
    const endpointId = "https_api_test"; // Matches generated ID from endpoint

    // Create fake transport with getSignatureStatuses response
    const fakeTransport = createFakeRpcTransport({
      endpointUrl: endpoint,
      endpointId,
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "confirmed",
                  slot: 100,
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const transports = new Map([[endpointId, fakeTransport]]);

    const sdkResult = createSolanaReliabilitySdk(
      {
        endpoints: [endpoint],
        confirmation: { timeoutMs: 10000, pollIntervalMs: 100 },
        metrics: metricsSink,
      },
      { transports },
    );

    expect(isOk(sdkResult)).toBe(true);
    if (isErr(sdkResult)) return;

    const sdk = sdkResult.value;

    // Confirm transaction
    const confirmResult = await sdk.confirmTransaction("test-signature");

    expect(isOk(confirmResult)).toBe(true);

    // Check metrics
    const metrics = sdk.getMetrics();
    const confirmMetrics = metrics.filter((m) => m.type === "tx_confirmed" || m.type === "tx_timeout");
    expect(confirmMetrics.length).toBeGreaterThan(0);
  });

  it("records metric when SDK gets priority fee", async () => {
    const metricsSink = createInMemoryMetricsSink();
    const endpoint = "https://api.test";
    const endpointId = "https_api_test"; // Matches generated ID from endpoint

    // Create fake transport with getRecentPrioritizationFees response
    const fakeTransport = createFakeRpcTransport({
      endpointUrl: endpoint,
      endpointId,
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          {
            success: [
              { prioritizationFee: 100 },
              { prioritizationFee: 200 },
            ],
          },
        ],
      ]),
    });

    const transports = new Map([[endpointId, fakeTransport]]);

    const sdkResult = createSolanaReliabilitySdk(
      {
        endpoints: [endpoint],
        priorityFee: { fallbackMicroLamports: 50, maxStaleMs: 30000 },
        metrics: metricsSink,
      },
      { transports },
    );

    expect(isOk(sdkResult)).toBe(true);
    if (isErr(sdkResult)) return;

    const sdk = sdkResult.value;

    // Get priority fee
    const feeResult = await sdk.getPriorityFee();

    expect(isOk(feeResult)).toBe(true);

    // Check metrics
    const metrics = sdk.getMetrics();
    const feeMetrics = metrics.filter((m) => m.type === "fee_estimate");
    expect(feeMetrics.length).toBeGreaterThan(0);
  });

  it("in-memory metrics can be read back", async () => {
    const metricsSink = createInMemoryMetricsSink();
    const endpoint = "https://api.test";
    const endpointId = "https_api_test"; // Matches generated ID from endpoint

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: endpoint,
      endpointId,
      responses: new Map([
        ["sendTransaction", { success: "sig-1" }],
      ]),
    });

    const transports = new Map([[endpointId, fakeTransport]]);

    const sdkResult = createSolanaReliabilitySdk(
      {
        endpoints: [endpoint],
        metrics: metricsSink,
      },
      { transports },
    );

    expect(isOk(sdkResult)).toBe(true);
    if (isErr(sdkResult)) return;

    const sdk = sdkResult.value;

    // Record a transaction
    await sdk.sendTransaction(Buffer.from("tx").toString("base64"), "hash", 100);

    // Get metrics both ways
    const sdkMetrics = sdk.getMetrics();
    const sinkMetrics = metricsSink.getEvents();

    expect(sdkMetrics.length).toBeGreaterThan(0);
    expect(sinkMetrics.length).toBeGreaterThan(0);
    expect(sdkMetrics).toEqual(sinkMetrics);
  });

  it("OTEL metrics sink receives mapped payload", async () => {
    const payloads: any[] = [];
    const otelSink = createOtelMetricsSink((payload) => {
      payloads.push(payload);
    });

    const endpoint = "https://api.test";
    const endpointId = "https_api_test"; // Matches generated ID from endpoint

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: endpoint,
      endpointId,
      responses: new Map([
        ["sendTransaction", { success: "sig-1" }],
      ]),
    });

    const transports = new Map([[endpointId, fakeTransport]]);

    const sdkResult = createSolanaReliabilitySdk(
      {
        endpoints: [endpoint],
        metrics: otelSink,
      },
      { transports },
    );

    expect(isOk(sdkResult)).toBe(true);
    if (isErr(sdkResult)) return;

    const sdk = sdkResult.value;

    // Record a transaction
    await sdk.sendTransaction(Buffer.from("tx").toString("base64"), "hash", 100);

    // Check OTEL payloads were sent
    expect(payloads.length).toBeGreaterThan(0);

    // Verify payload structure
    for (const payload of payloads) {
      expect(typeof payload.name).toBe("string");
      expect(payload.name.startsWith("sdk.")).toBe(true);
      expect(typeof payload.timestampMs).toBe("number");
      expect(typeof payload.attributes).toBe("object");
    }
  });
});
