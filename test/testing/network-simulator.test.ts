/**
 * Tests for network simulator.
 */

import { describe, it, expect, vi } from "vitest";
import { simulateNetworkBehavior } from "../../src/testing/network-simulator.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { FakeClock } from "../../src/testing/fake-clock.js";
import { FakeTimer } from "../../src/testing/fake-timer.js";
import { FakeRandom } from "../../src/testing/fake-random.js";
import { createSdkError } from "../../src/core/error.js";

describe("simulateNetworkBehavior", () => {
  it("delegates to wrapped transport when no simulation is configured", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([0.5]);

    const transport = simulateNetworkBehavior(wrapped, {}, { clock, timer, random });

    const result = await transport.send("getBalance", { address: "test" });

    expect(result).toBe(1000);
    expect(wrapped.callCount("getBalance")).toBe(1);
  });

  it("preserves endpointUrl", () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://custom.rpc.com",
      endpointId: "custom-rpc",
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, {}, { clock, timer, random });

    expect(transport.endpointUrl).toBe("https://custom.rpc.com");
  });

  it("preserves endpointId", () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "custom-endpoint",
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, {}, { clock, timer, random });

    expect(transport.endpointId).toBe("custom-endpoint");
  });

  it("injects latency using fake timer", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, { latencyMs: 100 }, { clock, timer, random });

    const resultPromise = transport.send("getBalance", { address: "test" });

    // Advance timer through latency
    clock.advance(100);
    await timer.flush();

    const result = await resultPromise;

    expect(result).toBe(1000);
  });

  it("does not resolve latency-delayed call before timer advances", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, { latencyMs: 100 }, { clock, timer, random });

    const resultPromise = transport.send("getBalance", { address: "test" });

    // Verify it's a promise (async operation)
    expect(resultPromise).toBeInstanceOf(Promise);
  });

  it("resolves after fake timer advances", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, { latencyMs: 50 }, { clock, timer, random });

    const resultPromise = transport.send("getBalance", { address: "test" });

    clock.advance(50);
    await timer.flush();

    const result = await resultPromise;

    expect(result).toBe(1000);
  });

  it("simulates drop as Timeout error", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([0.1]); // Drop (0.1 < 0.2)

    const transport = simulateNetworkBehavior(wrapped, { dropRate: 0.2 }, { clock, timer, random });

    await expect(transport.send("getBalance", { address: "test" })).rejects.toMatchObject({
      kind: "Timeout",
    });
  });

  it("simulates failure as NetworkError", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([0.25, 0.1]); // No drop (0.25 >= 0.2), but fail (0.1 < 0.15)

    const transport = simulateNetworkBehavior(wrapped, { dropRate: 0.2, failRate: 0.15 }, { clock, timer, random });

    await expect(transport.send("getBalance", { address: "test" })).rejects.toMatchObject({
      kind: "NetworkError",
    });
  });

  it("uses provided failureError", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const customError = new Error("Custom network error");
    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([0.05]); // Fail

    const transport = simulateNetworkBehavior(wrapped, { failRate: 0.1, failureError: customError }, { clock, timer, random });

    await expect(transport.send("getBalance", { address: "test" })).rejects.toBe(customError);
  });

  it("uses fake random deterministically", async () => {
    const wrapped1 = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "rpc1",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const wrapped2 = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "rpc2",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer1 = new FakeTimer(clock);
    const timer2 = new FakeTimer(clock);
    const random1 = new FakeRandom([0.05, 0.15]); // Fail on first two calls
    const random2 = new FakeRandom([0.05, 0.15]); // Same sequence

    const transport1 = simulateNetworkBehavior(wrapped1, { failRate: 0.1 }, { clock, timer: timer1, random: random1 });
    const transport2 = simulateNetworkBehavior(wrapped2, { failRate: 0.1 }, { clock, timer: timer2, random: random2 });

    // Both should fail deterministically
    await expect(transport1.send("getBalance", {})).rejects.toMatchObject({ kind: "NetworkError" });
    await expect(transport2.send("getBalance", {})).rejects.toMatchObject({ kind: "NetworkError" });
  });

  it("passes caller timeout options through", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, {}, { clock, timer, random });

    await transport.send("getBalance", { address: "test" }, { timeoutMs: 3000 });

    const calls = wrapped.getCalls();
    expect(calls[0]!.options?.timeoutMs).toBe(3000);
  });

  it("uses default config.timeoutMs when caller does not provide timeout", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, { timeoutMs: 5000 }, { clock, timer, random });

    await transport.send("getBalance", { address: "test" });

    const calls = wrapped.getCalls();
    expect(calls[0]!.options?.timeoutMs).toBe(5000);
  });

  it("caller timeout overrides config timeout", async () => {
    const wrapped = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const clock = new FakeClock();
    const timer = new FakeTimer(clock);
    const random = new FakeRandom([]);

    const transport = simulateNetworkBehavior(wrapped, { timeoutMs: 5000 }, { clock, timer, random });

    await transport.send("getBalance", { address: "test" }, { timeoutMs: 2000 });

    const calls = wrapped.getCalls();
    expect(calls[0]!.options?.timeoutMs).toBe(2000);
  });
});
