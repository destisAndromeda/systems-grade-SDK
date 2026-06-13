/**
 * Tests for metrics recording.
 */

import { describe, it } from "vitest";
import { createInMemoryMetricsSink } from "../../src/metrics/memory";

describe("createInMemoryMetricsSink", () => {
  it("records metric events", () => {
    // TODO: create sink, record event, getEvents returns array with 1 event
  });

  it("accumulates multiple events", () => {
    // TODO: record 3 events, assert getEvents has length 3
  });

  it("preserves event details", () => {
    // TODO: record event with metadata, assert getEvents()[0].metadata preserved
  });
});

describe("createOtelMetricsSink", () => {
  it("calls onSend callback for each event", () => {
    // TODO: create OTEL sink with onSend mock, record event,
    // assert onSend was called
  });

  it("maps event to OTEL payload", () => {
    // TODO: record event, assert onSend called with payload
    // containing name and attributes
  });
});
