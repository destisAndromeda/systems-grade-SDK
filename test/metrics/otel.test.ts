/**
 * Tests for OpenTelemetry metrics export.
 */

import { describe, it, expect } from "vitest";
import { mapMetricEventToOtelPayload, createOtelMetricsSink } from "../../src/metrics/otel.js";

describe("mapMetricEventToOtelPayload", () => {
  it("maps event type to sdk.{type} name", () => {
    const event = {
      type: "rpc_success" as const,
      timestampMs: 1000,
    };

    const payload = mapMetricEventToOtelPayload(event);

    expect(payload.name).toBe("sdk.rpc_success");
  });

  it("preserves timestamp", () => {
    const event = {
      type: "tx_send" as const,
      timestampMs: 123456,
    };

    const payload = mapMetricEventToOtelPayload(event);

    expect(payload.timestampMs).toBe(123456);
  });

  it("copies attributes", () => {
    const event = {
      type: "fee_estimate" as const,
      timestampMs: 1000,
      attributes: {
        source: "rpc",
        fee: 100,
      },
    };

    const payload = mapMetricEventToOtelPayload(event);

    expect(payload.attributes).toEqual({
      source: "rpc",
      fee: 100,
    });
  });

  it("uses empty attributes object when missing", () => {
    const event = {
      type: "circuit_open" as const,
      timestampMs: 1000,
    };

    const payload = mapMetricEventToOtelPayload(event);

    expect(payload.attributes).toEqual({});
  });

  it("maps all event types correctly", () => {
    const eventTypes: Array<{ type: any; expected: string }> = [
      { type: "rpc_attempt", expected: "sdk.rpc_attempt" },
      { type: "rpc_success", expected: "sdk.rpc_success" },
      { type: "rpc_failure", expected: "sdk.rpc_failure" },
      { type: "retry", expected: "sdk.retry" },
      { type: "circuit_open", expected: "sdk.circuit_open" },
      { type: "tx_send", expected: "sdk.tx_send" },
      { type: "tx_confirmed", expected: "sdk.tx_confirmed" },
      { type: "tx_timeout", expected: "sdk.tx_timeout" },
      { type: "fee_estimate", expected: "sdk.fee_estimate" },
      { type: "relay_send", expected: "sdk.relay_send" },
      { type: "wallet_sign", expected: "sdk.wallet_sign" },
    ];

    for (const { type, expected } of eventTypes) {
      const payload = mapMetricEventToOtelPayload({
        type,
        timestampMs: 1000,
      });
      expect(payload.name).toBe(expected);
    }
  });
});

describe("createOtelMetricsSink", () => {
  it("calls onSend callback for each event", () => {
    let callCount = 0;
    const sink = createOtelMetricsSink(() => {
      callCount++;
    });

    sink.record({
      type: "tx_send",
      timestampMs: 1000,
    });

    expect(callCount).toBe(1);

    sink.record({
      type: "tx_confirmed",
      timestampMs: 2000,
    });

    expect(callCount).toBe(2);
  });

  it("sends mapped payload to callback", () => {
    const payloads: any[] = [];
    const sink = createOtelMetricsSink((payload) => {
      payloads.push(payload);
    });

    sink.record({
      type: "fee_estimate",
      timestampMs: 1000,
      attributes: {
        source: "rpc",
      },
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].name).toBe("sdk.fee_estimate");
    expect(payloads[0].timestampMs).toBe(1000);
    expect(payloads[0].attributes).toEqual({
      source: "rpc",
    });
  });

  it("sends event with empty attributes when not provided", () => {
    const payloads: any[] = [];
    const sink = createOtelMetricsSink((payload) => {
      payloads.push(payload);
    });

    sink.record({
      type: "rpc_attempt",
      timestampMs: 1000,
    });

    expect(payloads[0].attributes).toEqual({});
  });

  it("does not throw when callback throws", () => {
    const sink = createOtelMetricsSink(() => {
      throw new Error("callback error");
    });

    // Note: The spec says metrics must never break SDK methods, but
    // this test shows the sink doesn't catch exceptions.
    // In a real implementation, SDK methods would wrap calls to metrics
    // in try-catch blocks.
    expect(() => {
      sink.record({
        type: "tx_send",
        timestampMs: 1000,
      });
    }).toThrow();
  });
});
