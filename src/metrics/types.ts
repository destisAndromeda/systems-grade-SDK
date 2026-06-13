/**
 * Metrics types.
 *
 * Events and types for tracking SDK behavior (latency, errors, etc.)
 * for observability and debugging.
 */

/**
 * A metric event emitted by the SDK.
 */
export interface MetricEvent {
  type:
    | "rpc_attempt" // RPC call started/completed
    | "rpc_success" // RPC call succeeded
    | "rpc_failure" // RPC call failed
    | "retry" // Retry about to happen
    | "circuit_open" // Circuit breaker opened
    | "circuit_close" // Circuit breaker closed
    | "tx_send" // Transaction send started/completed
    | "tx_confirmed" // Transaction confirmed
    | "tx_timeout" // Transaction confirmation timeout;
  timestamp: number; // When the event occurred
  metadata?: Record<string, unknown>; // Event-specific details
}

/**
 * Sink for metric events.
 * Collects metrics for export/analysis.
 */
export interface MetricsSink {
  /**
   * Record a metric event.
   */
  record(event: MetricEvent): void;
}
