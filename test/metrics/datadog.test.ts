/**
 * Datadog metrics exporter tests.
 *
 * Test 1 uses a real local HTTP server + global fetch (no mocks).
 * Tests 2-4 cover error handling, tag mapping, and public index exports.
 */

import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import {
  createDatadogMetricsSink,
  sendDatadogMetrics,
  mapMetricEventToDatadogPayload,
} from "../../src/metrics/datadog.js";
import { isOk } from "../../src/core/result.js";
import type { MetricEvent } from "../../src/metrics/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid MetricEvent for use across tests. */
function makeEvent(overrides?: Partial<MetricEvent>): MetricEvent {
  return {
    type: "rpc_attempt",
    timestampMs: 1_710_000_000_000, // 1710000000 in POSIX seconds
    attributes: {
      endpointId: "rpc-a",
      method: "sendTransaction",
      latencyMs: 42,
    },
    ...overrides,
  };
}

/** Start a minimal HTTP server; resolve once it is listening. */
function startServer(
  handler: (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ) => void,
): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

/** Read the full request body as a string. */
function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Datadog metrics exporter", () => {
  let server: Server | undefined;

  afterEach(() => {
    if (server) {
      server.close();
      server = undefined;
    }
  });

  // ─── Test 1: real fetch → real local server ────────────────────────────

  it("sends Datadog metrics payload to a local HTTP server", async () => {
    interface Captured {
      method: string;
      url: string;
      headers: Record<string, string>;
      rawBody: string;
      parsedBody: any;
    }

    let captured: Captured | undefined;
    const done = new Promise<void>((resolve) => {
      ({ server } = {
        server: undefined as unknown as Server,
      });
      void startServer(async (req, res) => {
        const rawBody = await readBody(req);
        captured = {
          method: req.method ?? "",
          url: req.url ?? "",
          headers: req.headers as Record<string, string>,
          rawBody,
          parsedBody: JSON.parse(rawBody),
        };
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        resolve();
      }).then(({ server: s, baseUrl }) => {
        server = s;

        const sink = createDatadogMetricsSink({
          apiKey: "test-api-key",
          endpoint: baseUrl,
          service: "solana-reliability-sdk",
          env: "test",
          defaultTags: ["component:sdk"],
        });

        sink.record(makeEvent());
      });
    });

    await done;

    expect(captured).toBeDefined();
    expect(captured!.method).toBe("POST");
    expect(captured!.url).toBe("/api/v2/series");
    expect(captured!.headers["dd-api-key"]).toBe("test-api-key");
    expect(captured!.headers["content-type"]).toContain("application/json");

    const body = captured!.parsedBody;
    expect(Array.isArray(body.series)).toBe(true);
    expect(body.series.length).toBeGreaterThan(0);

    const series = body.series[0];
    expect(series.metric).toMatch(/^solana_reliability_sdk\./);
    expect(typeof series.points[0].timestamp).toBe("number");
    expect(typeof series.points[0].value).toBe("number");

    const tags: string[] = series.tags;
    expect(tags).toContain("service:solana-reliability-sdk");
    expect(tags).toContain("env:test");
    expect(tags).toContain("component:sdk");
  });

  // ─── Test 2: non-2xx → sendDatadogMetrics returns err ─────────────────

  it("sendDatadogMetrics returns err when Datadog returns non-2xx", async () => {
    const { server: localServer } = await startServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal server error" }));
    });
    server = localServer;

    const { port } = localServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    const payload = mapMetricEventToDatadogPayload(
      makeEvent(),
      { service: "test", env: "test", defaultTags: [] },
      () => Date.now(),
    );

    const result = await sendDatadogMetrics(payload, {
      apiKey: "test-api-key",
      endpoint: baseUrl,
    });

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.message).toContain("500");
    }
  });

  // ─── Test 3: attribute → tag mapping ──────────────────────────────────

  it("maps MetricEvent attributes into Datadog tags", () => {
    const event = makeEvent({
      type: "rpc_success",
      attributes: {
        endpointId: "rpc-a",
        method: "sendTransaction",
        success: true,
      },
    });

    const payload = mapMetricEventToDatadogPayload(
      event,
      { service: "my-service", env: "production", version: "1.2.3", defaultTags: ["team:core"] },
      () => 1_710_000_000_000,
    );

    const tags = payload.series[0]!.tags;

    // Attribute tags
    expect(tags).toContain("endpointId:rpc-a");
    expect(tags).toContain("method:sendTransaction");
    expect(tags).toContain("success:true");

    // Config tags
    expect(tags).toContain("service:my-service");
    expect(tags).toContain("env:production");
    expect(tags).toContain("version:1.2.3");
    expect(tags).toContain("team:core");

    // Metric name prefix
    expect(payload.series[0]!.metric).toBe("solana_reliability_sdk.rpc.success");

    // Timestamp conversion (ms → seconds)
    expect(payload.series[0]!.points[0]!.timestamp).toBe(1_710_000_000);
  });

  // ─── Test 4: public index export ──────────────────────────────────────

  it("exports Datadog sink from public index", async () => {
    const index = await import("../../src/index.js");
    expect(typeof index.createDatadogMetricsSink).toBe("function");
    expect(typeof index.sendDatadogMetrics).toBe("function");
    expect(typeof index.mapMetricEventToDatadogPayload).toBe("function");
  });
});
