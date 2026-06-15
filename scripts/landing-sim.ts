#!/usr/bin/env tsx
/**
 * scripts/landing-sim.ts
 *
 * Deterministic landing simulation – Phase 10.3.
 *
 * Compares two submission strategies across six failure scenarios:
 *   A) Naive single-RPC (one endpoint, no retry, no circuit-breaker)
 *   B) SDK resilient routing (retry + circuit-breaker + best-endpoint selection)
 *
 * All "network calls" are simulated via injected fake transports — no real
 * network calls are made, results are fully deterministic on every run.
 *
 * Output is printed to stdout AND saved to artifacts/landing-sim-output.md.
 *
 * Run with:
 *   npx tsx scripts/landing-sim.ts
 *   npm run sim
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── SDK internals ────────────────────────────────────────────────────────────
import { createEndpointRegistry } from "../src/rpc/registry.js";
import { createResilientRpcClient } from "../src/rpc/resilient-client.js";
import { createEndpointId } from "../src/rpc/endpoint.js";
import { createSdkError } from "../src/core/error.js";
import { isOk } from "../src/core/result.js";
import type { RpcTransport, ResilientRpcConfig } from "../src/rpc/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimResult {
  scenario: string;
  naiveLanded: boolean;
  naiveAttempts: number;
  naiveLatencyMs: number;
  sdkLanded: boolean;
  sdkAttempts: number;
  sdkLatencyMs: number;
}

type FakeResponse = { success: unknown } | { error: ReturnType<typeof createSdkError> };

// ─── Fake errors ──────────────────────────────────────────────────────────────

const ERR_TIMEOUT  = { error: createSdkError("Timeout",      "Request timed out") };
const ERR_RATE     = { error: createSdkError("RateLimited",  "429 Too Many Requests") };
const ERR_NETWORK  = { error: createSdkError("NetworkError", "ECONNRESET") };
const ERR_SLOT_LAG = { error: createSdkError("NetworkError", "Slot too old / slot lag") };
const TX_OK        = { success: "sig-ok" };

// ─── ID helper (mirrors createEndpointId logic) ───────────────────────────────

function urlToId(url: string): string {
  return createEndpointId({ url, weight: 1 });
}

// ─── Fake clock / timer / random ─────────────────────────────────────────────

function makeFakeDeps(baseNowMs = 0) {
  let _now = baseNowMs;

  const clock = { now: () => _now };

  const timer = {
    setTimeout(fn: () => void, ms: number): ReturnType<typeof globalThis.setTimeout> {
      // Defer execution to the event loop so that promise microtasks (like successful
      // transport resolutions) can settle before the timeout fires.
      return globalThis.setTimeout(() => {
        _now += ms;
        fn();
      }, 0);
    },
    clearTimeout(id: ReturnType<typeof globalThis.setTimeout>): void {
      globalThis.clearTimeout(id);
    },
  };

  const random = { next: () => 0.5 }; // stable jitter

  return { clock, timer, random };
}

// ─── Sequential fake transport ────────────────────────────────────────────────

function makeSeqTransport(
  url: string,
  responses: FakeResponse[],
): RpcTransport & { callCount: () => number } {
  let idx = 0;
  let calls = 0;

  return {
    endpointId:  urlToId(url),
    endpointUrl: url,

    async send<TParams, TResult>(
      method: string,
      params: TParams,
    ): Promise<TResult> {
      void method;
      void params;
      calls++;
      const resp: FakeResponse = responses[idx] ?? { success: "fallback-sig" };
      idx++;
      if ("error" in resp) throw resp.error;
      return resp.success as TResult;
    },

    callCount: () => calls,
  };
}

// ─── Default SDK config ───────────────────────────────────────────────────────

const DEFAULT_SDK_CONFIG: ResilientRpcConfig = {
  retry: {
    maxAttempts: 4,
    baseDelayMs: 50,
    maxDelayMs: 2_000,
    jitterRatio: 0,
  },
  circuitBreaker: {
    failureThreshold: 3,
    openDurationMs: 5_000,
  },
  scoring: {
    latencyWeight: 0.4,
    failureWeight: 0.3,
    recentFailurePenalty: 0.3,
  },
  defaultTimeoutMs: 5_000,
};

// ─── Naive submission ─────────────────────────────────────────────────────────

async function runNaive(
  transport: RpcTransport & { callCount: () => number },
): Promise<{ landed: boolean; attempts: number; latencyMs: number }> {
  const t0 = Date.now();
  try {
    await transport.send("sendTransaction", ["base64tx"]);
    return { landed: true, attempts: transport.callCount(), latencyMs: Date.now() - t0 };
  } catch {
    return { landed: false, attempts: transport.callCount(), latencyMs: Date.now() - t0 };
  }
}

// ─── SDK submission ───────────────────────────────────────────────────────────

async function runSdk(
  transports: Map<string, RpcTransport & { callCount: () => number }>,
  endpointUrls: string[],
  config: ResilientRpcConfig = DEFAULT_SDK_CONFIG,
): Promise<{ landed: boolean; attempts: number; latencyMs: number }> {
  const registryResult = createEndpointRegistry(endpointUrls);
  if (!isOk(registryResult)) {
    return { landed: false, attempts: 0, latencyMs: 0 };
  }

  const deps = makeFakeDeps();

  const client = createResilientRpcClient(
    transports as unknown as Map<string, RpcTransport>,
    config,
    {
      registry: registryResult.value,
      clock: deps.clock,
      timer: deps.timer,
      random: deps.random,
    },
  );

  const t0 = Date.now();
  let landed = false;
  try {
    await client.send("sendTransaction", ["base64tx"]);
    landed = true;
  } catch {
    // Already false
  }

  const attempts = [...transports.values()].reduce(
    (sum, t) => sum + t.callCount(),
    0,
  );

  return { landed, attempts, latencyMs: Date.now() - t0 };
}

// ─── Scenario runner ──────────────────────────────────────────────────────────

async function runScenarios(): Promise<SimResult[]> {
  const results: SimResult[] = [];

  const EP1 = "https://ep1.com";
  const EP2 = "https://ep2.com";

  function single(url: string, responses: FakeResponse[]) {
    const t = makeSeqTransport(url, responses);
    return new Map([[urlToId(url), t]]);
  }

  function dual(
    url1: string, resp1: FakeResponse[],
    url2: string, resp2: FakeResponse[],
  ) {
    const t1 = makeSeqTransport(url1, resp1);
    const t2 = makeSeqTransport(url2, resp2);
    return new Map([
      [urlToId(url1), t1],
      [urlToId(url2), t2],
    ]);
  }

  async function scenario(
    name: string,
    naiveTransport: RpcTransport & { callCount: () => number },
    sdkTransports: Map<string, RpcTransport & { callCount: () => number }>,
    sdkUrls: string[],
    sdkConfig?: ResilientRpcConfig,
  ): Promise<void> {
    const n = await runNaive(naiveTransport);
    const s = await runSdk(sdkTransports, sdkUrls, sdkConfig);
    results.push({
      scenario: name,
      naiveLanded: n.landed, naiveAttempts: n.attempts, naiveLatencyMs: n.latencyMs,
      sdkLanded:   s.landed, sdkAttempts:   s.attempts, sdkLatencyMs:   s.latencyMs,
    });
  }

  // 1. Happy path
  await scenario(
    "Happy path",
    makeSeqTransport(EP1, [TX_OK]),
    single(EP1, [TX_OK]),
    [EP1],
  );

  // 2. Single timeout → retry succeeds
  await scenario(
    "Timeout → retry succeeds",
    makeSeqTransport(EP1, [ERR_TIMEOUT]),
    single(EP1, [ERR_TIMEOUT, TX_OK]),
    [EP1],
  );

  // 3. Rate-limit burst → fallback endpoint
  await scenario(
    "Rate-limit → fallback endpoint",
    makeSeqTransport(EP1, [ERR_RATE]),
    dual(EP1, [ERR_RATE, ERR_RATE], EP2, [TX_OK]),
    [EP1, EP2],
  );

  // 4. Slot lag → failover
  await scenario(
    "Slot lag → failover",
    makeSeqTransport(EP1, [ERR_SLOT_LAG]),
    dual(EP1, [ERR_SLOT_LAG], EP2, [TX_OK]),
    [EP1, EP2],
  );

  // 5. Total network failure
  await scenario(
    "Total network failure",
    makeSeqTransport(EP1, [ERR_NETWORK]),
    dual(
      EP1, [ERR_NETWORK, ERR_NETWORK, ERR_NETWORK, ERR_NETWORK],
      EP2, [ERR_NETWORK, ERR_NETWORK, ERR_NETWORK, ERR_NETWORK],
    ),
    [EP1, EP2],
  );

  // 6. Flaky endpoint (3 timeouts, 4th ok)
  await scenario(
    "Flaky endpoint (3 timeouts, 4th ok)",
    makeSeqTransport(EP1, [ERR_TIMEOUT]),
    single(EP1, [ERR_TIMEOUT, ERR_TIMEOUT, ERR_TIMEOUT, TX_OK]),
    [EP1],
    {
      ...DEFAULT_SDK_CONFIG,
      retry: { ...DEFAULT_SDK_CONFIG.retry, maxAttempts: 5 },
      circuitBreaker: { ...DEFAULT_SDK_CONFIG.circuitBreaker, failureThreshold: 5 },
    },
  );

  return results;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function icon(v: boolean): string { return v ? "✅" : "❌"; }

function renderMarkdown(results: SimResult[]): string {
  const header =
    `# Landing Simulation Results\n\n` +
    `> Generated: ${new Date().toISOString()}\n>\n` +
    `> **A** = Naive single-RPC (one endpoint, no retry, no circuit-breaker)  \n` +
    `> **B** = SDK resilient routing (retry + circuit-breaker + best-endpoint selection)\n\n` +
    `| Scenario | A landed | A attempts | A latency | B landed | B attempts | B latency |\n` +
    `|----------|:--------:|:----------:|----------:|:--------:|:----------:|----------:|\n`;

  const rows = results
    .map(
      (r) =>
        `| ${r.scenario} | ${icon(r.naiveLanded)} | ${r.naiveAttempts} | ${r.naiveLatencyMs} ms` +
        ` | ${icon(r.sdkLanded)} | ${r.sdkAttempts} | ${r.sdkLatencyMs} ms |`,
    )
    .join("\n");

  const sdkWins   = results.filter((r) =>  r.sdkLanded && !r.naiveLanded).length;
  const both      = results.filter((r) =>  r.sdkLanded &&  r.naiveLanded).length;
  const naiveWins = results.filter((r) => !r.sdkLanded &&  r.naiveLanded).length;
  const neither   = results.filter((r) => !r.sdkLanded && !r.naiveLanded).length;

  const summary =
    `\n\n## Summary\n\n` +
    `| Outcome | Scenarios |\n|---------|:---------:|\n` +
    `| SDK lands, naive fails | **${sdkWins}** |\n` +
    `| Both land | **${both}** |\n` +
    `| Naive lands, SDK fails | **${naiveWins}** |\n` +
    `| Neither lands | **${neither}** |\n`;

  return header + rows + summary;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🚀  Landing simulation — Phase 10.3\n");

  const results  = await runScenarios();
  const markdown = renderMarkdown(results);

  console.log(markdown);

  const __dirname    = path.dirname(fileURLToPath(import.meta.url));
  const artifactsDir = path.resolve(__dirname, "../artifacts");
  await fs.mkdir(artifactsDir, { recursive: true });

  const outPath = path.join(artifactsDir, "landing-sim-output.md");
  await fs.writeFile(outPath, markdown, "utf8");

  console.log(`\n✅  Results saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Landing sim failed:", err);
  process.exit(1);
});
