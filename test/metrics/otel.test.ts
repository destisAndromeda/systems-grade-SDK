/**
 * Tests for OpenTelemetry metrics export.
 */

import { describe, it } from "vitest";

describe("mapMetricEventToOtelPayload", () => {
  it("maps rpc_success event to OTEL payload", () => {
    // TODO: map rpc_success event, assert name includes "rpc" and "success"
  });

  it("includes metadata in attributes", () => {
    // TODO: event with metadata { method: "send", latencyMs: 100 },
    // assert payload.attributes contains those values
  });
});

describe("createOtelMetricsSink", () => {
  it("batches or sends events via callback", () => {
    // TODO: create sink with onSend mock, record event, verify onSend called
  });
});
