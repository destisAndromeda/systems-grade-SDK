/**
 * OpenTelemetry metrics sink.
 *
 * Exports metrics in OpenTelemetry format.
 * Can be configured to send to any OTEL-compatible backend.
 */

import type { MetricEvent, MetricsSink } from "./types.js";

/**
 * OTEL payload for metric events.
 */
export interface OtelPayload {
  name: string;
  timestampMs: number;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Map a metric event to an OTEL payload.
 *
 * Converts SDK metric events to OpenTelemetry format by:
 * - Prefixing event type with "sdk."
 * - Preserving timestamp
 * - Copying attributes (or using empty object if missing)
 *
 * @param event Metric event
 * @returns OTEL payload
 */
export function mapMetricEventToOtelPayload(event: MetricEvent): OtelPayload {
  return {
    name: `sdk.${event.type}`,
    timestampMs: event.timestampMs,
    attributes: event.attributes ?? {},
  };
}

/**
 * Create an OpenTelemetry metrics sink.
 *
 * Creates a sink that maps metric events to OTEL format and sends them.
 *
 * @param onSend Callback to send OTEL payload (e.g. to a collector)
 * @returns Metrics sink
 */
export function createOtelMetricsSink(
  onSend: (payload: OtelPayload) => void,
): MetricsSink {
  return {
    record(event: MetricEvent): void {
      const payload = mapMetricEventToOtelPayload(event);
      onSend(payload);
    },
  };
}
