/**
 * Datadog HTTP metrics exporter.
 *
 * Sends SDK metric events to the Datadog v2 metrics intake API.
 * No Datadog SDK or OpenTelemetry SDK dependency — plain fetch only.
 */

import type { MetricEvent, MetricsSink } from "./types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError } from "../core/error.js";

// ---------------------------------------------------------------------------
// Config & deps
// ---------------------------------------------------------------------------

export interface DatadogMetricsSinkConfig {
  /** Datadog API key (DD-API-KEY header). */
  apiKey: string;
  /** Base URL for Datadog intake. Defaults to "https://api.datadoghq.com". */
  endpoint?: string;
  /** Value for the `service:<service>` tag. */
  service?: string;
  /** Value for the `env:<env>` tag. */
  env?: string;
  /** Value for the `version:<version>` tag. */
  version?: string;
  /** Additional tags to attach to every series, in "key:value" format. */
  defaultTags?: string[];
}

export interface DatadogMetricsSinkDeps {
  /** Override global fetch for unit tests. */
  fetch?: typeof fetch;
  /** Override clock for timestamp generation. */
  nowMs?: () => number;
}

// ---------------------------------------------------------------------------
// Payload types (Datadog v2 /api/v2/series)
// ---------------------------------------------------------------------------

interface DatadogPoint {
  timestamp: number; // POSIX seconds
  value: number;
}

interface DatadogSeries {
  metric: string;
  type: 0; // 0 = gauge
  points: DatadogPoint[];
  tags: string[];
}

interface DatadogPayload {
  series: DatadogSeries[];
}

// ---------------------------------------------------------------------------
// Metric name mapping
// ---------------------------------------------------------------------------

/**
 * Map a SDK MetricEventType to a stable Datadog metric name with the
 * "solana_reliability_sdk." prefix.
 */
function mapMetricName(type: string): string {
  const table: Record<string, string> = {
    rpc_attempt:   "solana_reliability_sdk.rpc.attempt",
    rpc_success:   "solana_reliability_sdk.rpc.success",
    rpc_failure:   "solana_reliability_sdk.rpc.failure",
    retry:         "solana_reliability_sdk.rpc.retry",
    circuit_open:  "solana_reliability_sdk.rpc.circuit_open",
    tx_send:       "solana_reliability_sdk.tx.send",
    tx_confirmed:  "solana_reliability_sdk.tx.confirmed",
    tx_timeout:    "solana_reliability_sdk.tx.timeout",
    tx_send_and_confirm: "solana_reliability_sdk.tx.send_and_confirm",
    fee_estimate:  "solana_reliability_sdk.fee.estimate",
    relay_send:    "solana_reliability_sdk.relay.send",
    wallet_sign:   "solana_reliability_sdk.wallet.sign",
  };
  return table[type] ?? `solana_reliability_sdk.${type.replace(/_/g, ".")}`;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Map a MetricEvent and optional config tags to a Datadog v2 series payload.
 *
 * Exported so tests can exercise tag mapping in isolation.
 */
export function mapMetricEventToDatadogPayload(
  event: MetricEvent,
  config: Pick<DatadogMetricsSinkConfig, "service" | "env" | "version" | "defaultTags">,
  nowMs: () => number,
): DatadogPayload {
  const timestampSec = Math.floor((event.timestampMs ?? nowMs()) / 1000);

  // Derive a numeric value from attributes when present, otherwise 1
  const attrs = event.attributes ?? {};
  const rawValue = attrs["latencyMs"] ?? attrs["latency_ms"] ?? attrs["value"] ?? 1;
  const value = typeof rawValue === "number" ? rawValue : 1;

  // Build tags from event attributes
  const tags: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    tags.push(`${k}:${String(v)}`);
  }

  // Config tags
  if (config.service) tags.push(`service:${config.service}`);
  if (config.env)     tags.push(`env:${config.env}`);
  if (config.version) tags.push(`version:${config.version}`);

  // Default tags (already formatted as "key:value")
  if (config.defaultTags) {
    for (const t of config.defaultTags) {
      tags.push(t);
    }
  }

  return {
    series: [
      {
        metric: mapMetricName(event.type),
        type: 0,
        points: [{ timestamp: timestampSec, value }],
        tags,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Low-level sender (returns Result so tests can assert on errors)
// ---------------------------------------------------------------------------

/**
 * Send a pre-built Datadog payload to the v2 series endpoint.
 *
 * Returns Result<void> so callers can handle non-2xx responses without
 * crashing the SDK.
 */
export async function sendDatadogMetrics(
  payload: DatadogPayload,
  config: Pick<DatadogMetricsSinkConfig, "apiKey" | "endpoint">,
  deps?: Pick<DatadogMetricsSinkDeps, "fetch">,
): Promise<Result<void>> {
  const baseUrl = config.endpoint ?? "https://api.datadoghq.com";
  const url = `${baseUrl}/api/v2/series`;
  const fetchFn = deps?.fetch ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "DD-API-KEY": config.apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (e: unknown) {
    return err(
      createSdkError("NetworkError", `Datadog fetch failed: ${String(e)}`, { cause: e }),
    );
  }

  if (!response.ok) {
    return err(
      createSdkError(
        "InvalidResponse",
        `Datadog returned HTTP ${response.status}`,
      ),
    );
  }

  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Public MetricsSink factory
// ---------------------------------------------------------------------------

/**
 * Create a Datadog metrics sink.
 *
 * The sink is best-effort: failures are swallowed so the SDK never crashes
 * due to observability export failures. Use `sendDatadogMetrics` directly if
 * you need to inspect errors.
 */
export function createDatadogMetricsSink(
  config: DatadogMetricsSinkConfig,
  deps?: DatadogMetricsSinkDeps,
): MetricsSink {
  const nowMs = deps?.nowMs ?? (() => Date.now());

  return {
    record(event: MetricEvent): void {
      const payload = mapMetricEventToDatadogPayload(event, config, nowMs);
      // Fire-and-forget — swallow errors (best-effort observability)
      sendDatadogMetrics(payload, config, deps).catch(() => {
        // intentionally swallowed
      });
    },
  };
}
