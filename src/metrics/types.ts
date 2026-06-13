/**
 * Metrics types and interfaces.
 *
 * Simple metric events for observability.
 * Metrics are recorded synchronously and can be exported via a sink.
 */

/**
 * Types of events recorded by the SDK.
 */
export type MetricEventType =
  | "rpc_attempt"
  | "rpc_success"
  | "rpc_failure"
  | "retry"
  | "circuit_open"
  | "tx_send"
  | "tx_confirmed"
  | "tx_timeout"
  | "fee_estimate"
  | "relay_send"
  | "wallet_sign";

/**
 * A metric event with type, timestamp, and optional attributes.
 */
export interface MetricEvent {
  type: MetricEventType;
  timestampMs: number;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Sink for recording metric events.
 *
 * Implementations can store events in memory, export to OpenTelemetry,
 * send to analytics service, or log to console.
 */
export interface MetricsSink {
  /**
   * Record a metric event.
   *
   * @param event Metric event to record
   */
  record(event: MetricEvent): void;
}
