/**
 * OpenTelemetry metrics sink.
 *
 * Exports metrics in OpenTelemetry format.
 * Can be configured to send to any OTEL-compatible backend.
 */

import type { MetricEvent, MetricsSink } from "./types.js";

/**
 * OTEL payload mapper for metric events.
 */
export interface OtelPayload {
  name: string;
  value: number;
  attributes?: Record<string, string | number>;
  timestamp?: number;
}

/**
 * Create an OpenTelemetry metrics sink.
 *
 * @param onSend Callback to send OTEL payload (e.g. to a collector)
 * @returns Metrics sink
 */
export function createOtelMetricsSink(
  onSend: (payload: OtelPayload) => void,
): MetricsSink {
  // TODO: return sink that maps MetricEvent to OtelPayload and calls onSend
  throw new Error("TODO");
}

/**
 * Map a metric event to an OTEL payload.
 *
 * @param event Metric event
 * @returns OTEL payload
 */
export function mapMetricEventToOtelPayload(event: MetricEvent): OtelPayload {
  // TODO: convert MetricEvent to OtelPayload with appropriate name and attributes
  throw new Error("TODO");
}
