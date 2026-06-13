/**
 * Tests for fake RPC transport.
 */

import { describe, it, expect } from "vitest";
import { createFakeRpcTransport, FakeRpcTransportBuilder } from "../../src/testing/fake-transport.js";
import { createSdkError } from "../../src/core/error.js";

describe("createFakeRpcTransport", () => {
  it("returns configured success response", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    const result = await transport.send("getBalance", { address: "test" });

    expect(result).toBe(1000);
  });

  it("throws configured SDK error", async () => {
    const error = createSdkError("NetworkError", "Connection failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { error }]]),
    });

    await expect(transport.send("getBalance", { address: "test" })).rejects.toBe(error);
  });

  it("throws InvalidResponse for unknown method", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map(),
    });

    await expect(transport.send("unknownMethod", {})).rejects.toMatchObject({
      kind: "InvalidResponse",
    });
  });

  it("preserves endpointUrl", () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://custom.rpc.com",
      endpointId: "custom-rpc",
    });

    expect(transport.endpointUrl).toBe("https://custom.rpc.com");
  });

  it("preserves endpointId", () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "custom-id",
    });

    expect(transport.endpointId).toBe("custom-id");
  });

  it("records method name in calls", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    await transport.send("getBalance", { address: "test" });

    const calls = transport.getCalls();
    expect(calls[0]!.method).toBe("getBalance");
  });

  it("records params in calls", async () => {
    const params = { address: "test", amount: 100 };
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["transfer", { success: true }]]),
    });

    await transport.send("transfer", params);

    const calls = transport.getCalls();
    expect(calls[0]!.params).toEqual(params);
  });

  it("records options in calls", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([["getBalance", { success: 1000 }]]),
    });

    await transport.send("getBalance", { address: "test" }, { timeoutMs: 5000 });

    const calls = transport.getCalls();
    expect(calls[0]!.options?.timeoutMs).toBe(5000);
  });

  it("callCount returns total calls", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([
        ["getBalance", { success: 1000 }],
        ["transfer", { success: true }],
      ]),
    });

    await transport.send("getBalance", { address: "test" });
    await transport.send("transfer", { to: "recipient" });
    await transport.send("getBalance", { address: "test2" });

    expect(transport.callCount()).toBe(3);
  });

  it("callCount(method) returns per-method calls", async () => {
    const transport = createFakeRpcTransport({
      endpointUrl: "https://api.solana.com",
      endpointId: "solana-rpc",
      responses: new Map([
        ["getBalance", { success: 1000 }],
        ["transfer", { success: true }],
      ]),
    });

    await transport.send("getBalance", { address: "test" });
    await transport.send("transfer", { to: "recipient" });
    await transport.send("getBalance", { address: "test2" });

    expect(transport.callCount("getBalance")).toBe(2);
    expect(transport.callCount("transfer")).toBe(1);
  });
});

describe("FakeRpcTransportBuilder", () => {
  it("builds transport with response", async () => {
    const transport = new FakeRpcTransportBuilder(
      "https://api.solana.com",
      "solana-rpc",
    )
      .withResponse("getBalance", 1000)
      .build();

    const result = await transport.send("getBalance", { address: "test" });

    expect(result).toBe(1000);
  });

  it("builds transport with error", async () => {
    const error = createSdkError("NetworkError", "Connection failed");
    const transport = new FakeRpcTransportBuilder(
      "https://api.solana.com",
      "solana-rpc",
    )
      .withError("getBalance", error)
      .build();

    await expect(transport.send("getBalance", { address: "test" })).rejects.toBe(error);
  });

  it("supports chaining", async () => {
    const transport = new FakeRpcTransportBuilder(
      "https://api.solana.com",
      "solana-rpc",
    )
      .withResponse("getBalance", 1000)
      .withResponse("transfer", true)
      .withError("invalidMethod", createSdkError("NetworkError", "Failed"))
      .build();

    expect(await transport.send("getBalance", {})).toBe(1000);
    expect(await transport.send("transfer", {})).toBe(true);
    await expect(transport.send("invalidMethod", {})).rejects.toMatchObject({
      kind: "NetworkError",
    });
  });

  it("produces independent transports from independent builders", async () => {
    const builder1 = new FakeRpcTransportBuilder(
      "https://api1.solana.com",
      "rpc1",
    ).withResponse("getBalance", 1000);

    const builder2 = new FakeRpcTransportBuilder(
      "https://api2.solana.com",
      "rpc2",
    ).withResponse("getBalance", 2000);

    const transport1 = builder1.build();
    const transport2 = builder2.build();

    expect(await transport1.send("getBalance", {})).toBe(1000);
    expect(await transport2.send("getBalance", {})).toBe(2000);
  });
});
