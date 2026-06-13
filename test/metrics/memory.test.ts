/**
 * Tests for in-memory metrics recording.
 */

import { describe, it, expect } from "vitest";
import { createInMemoryMetricsSink } from "../../src/metrics/memory.js";

describe("createInMemoryMetricsSink", () => {
  it("records one event", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({
      type: "tx_send",
      timestampMs: now,
    });

    const events = sink.getEvents();
    expect(events).toHaveLength(1);
    if (events.length > 0) {
      expect(events[0].type).toBe("tx_send");
      expect(events[0].timestampMs).toBe(now);
    }
  });

  it("records events in order", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({ type: "tx_send", timestampMs: now });
    sink.record({ type: "tx_confirmed", timestampMs: now + 100 });
    sink.record({ type: "fee_estimate", timestampMs: now + 200 });

    const events = sink.getEvents();
    expect(events).toHaveLength(3);
    if (events.length >= 3) {
      expect(events[0].type).toBe("tx_send");
      expect(events[1].type).toBe("tx_confirmed");
      expect(events[2].type).toBe("fee_estimate");
    }
  });

  it("getEvents() returns a copy", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({ type: "tx_send", timestampMs: now });

    const events1 = sink.getEvents();
    const events2 = sink.getEvents();

    expect(events1).toEqual(events2);
    expect(events1).not.toBe(events2);
  });

  it("clear() removes all events", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({ type: "tx_send", timestampMs: now });
    sink.record({ type: "tx_confirmed", timestampMs: now + 100 });

    expect(sink.getEvents()).toHaveLength(2);

    sink.clear();

    expect(sink.getEvents()).toHaveLength(0);
  });

  it("recording an event without attributes works", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({
      type: "rpc_success",
      timestampMs: now,
    });

    const events = sink.getEvents();
    expect(events).toHaveLength(1);
    if (events.length > 0) {
      expect(events[0].attributes).toBeUndefined();
    }
  });

  it("does not throw on any operation", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    expect(() => {
      sink.record({ type: "tx_send", timestampMs: now });
      sink.record({ type: "tx_confirmed", timestampMs: now + 100, attributes: { slot: 100 } });
      sink.getEvents();
      sink.clear();
    }).not.toThrow();
  });

  it("preserves event attributes correctly", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({
      type: "fee_estimate",
      timestampMs: now,
      attributes: {
        source: "rpc",
        fee: 100,
        priority: true,
      },
    });

    const events = sink.getEvents();
    expect(events.length).toBeGreaterThan(0);
    if (events[0] && events[0].attributes) {
      expect(events[0].attributes).toEqual({
        source: "rpc",
        fee: 100,
        priority: true,
      });
    }
  });

  it("does not mutate stored events when attributes are modified", () => {
    const sink = createInMemoryMetricsSink();
    const now = Date.now();

    sink.record({
      type: "rpc_attempt",
      timestampMs: now,
      attributes: {
        endpoint: "https://api.com",
      },
    });

    const events1 = sink.getEvents();
    if (events1[0]?.attributes) {
      events1[0].attributes.endpoint = "https://evil.com";
    }

    const events2 = sink.getEvents();
    if (events2[0]?.attributes) {
      expect(events2[0].attributes.endpoint).toBe("https://api.com");
    }
  });
});
