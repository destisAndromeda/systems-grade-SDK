/**
 * Tests for priority fee logic.
 */

import { describe, it, expect } from "vitest";
import {
  createStaticPriorityFeeProvider,
  createRpcPriorityFeeProvider,
  isPriorityFeeStale,
  getPriorityFeeEstimate,
} from "../../src/fee/priority-fee.js";
import type { PriorityFeeProvider, PriorityFeeEstimate } from "../../src/fee/types.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import type { RpcTransport } from "../../src/rpc/types.js";
import { createSdkError } from "../../src/core/error.js";
import { ok, err, isOk, isErr } from "../../src/core/result.js";

describe("createStaticPriorityFeeProvider", () => {
  it("returns provider named 'static'", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(100, clock);

    expect(provider.name).toBe("static");
  });

  it("returns configured fee", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(250, clock);

    const result = await provider.getEstimate(0);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(250);
    }
  });

  it("returns source 'static'", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(100, clock);

    const result = await provider.getEstimate(0);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.source).toBe("static");
    }
  });

  it("uses clock timestamp", async () => {
    const clock = createFakeClock(5000);
    const provider = createStaticPriorityFeeProvider(100, clock);

    const result = await provider.getEstimate(clock.now());
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.fetchedAtMs).toBe(5000);
    }
  });

  it("allows zero fee", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(0, clock);

    const result = await provider.getEstimate(0);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(0);
    }
  });

  it("returns InvalidConfig for negative fee", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(-100, clock);

    const result = await provider.getEstimate(0);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("returns InvalidConfig for non-finite fee", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(Infinity, clock);

    const result = await provider.getEstimate(0);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("does not throw", async () => {
    const clock = createFakeClock(0);
    const provider = createStaticPriorityFeeProvider(100, clock);

    await expect(provider.getEstimate(0)).resolves.toBeDefined();
  });
});

describe("createRpcPriorityFeeProvider", () => {
  it("returns provider named 'rpc'", () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    expect(provider.name).toBe("rpc");
  });

  it("calls getRecentPrioritizationFees", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: [{ prioritizationFee: 100 }] },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    await provider.getEstimate(0);

    expect(transport.callCount("getRecentPrioritizationFees")).toBe(1);
  });

  it("parses array response", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: [{ prioritizationFee: 100 }, { prioritizationFee: 200 }] },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(200);
      expect(result.value.source).toBe("rpc");
    }
  });

  it("parses { result: [...] } response", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: { result: [{ prioritizationFee: 50 }, { prioritizationFee: 150 }] } },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(150);
    }
  });

  it("parses { value: [...] } response", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: { value: [{ prioritizationFee: 75 }, { prioritizationFee: 125 }] } },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(125);
    }
  });

  it("chooses max prioritization fee", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: [{ prioritizationFee: 50 }, { prioritizationFee: 300 }, { prioritizationFee: 150 }] },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(300);
    }
  });

  it("ignores invalid entries when at least one valid fee exists", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          {
            success: [
              { prioritizationFee: "not a number" },
              { prioritizationFee: 100 },
              { notAFeeField: 200 },
              { prioritizationFee: -50 },
            ],
          },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(100);
    }
  });

  it("returns InvalidResponse when response is not object/array", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        ["getRecentPrioritizationFees", { success: "invalid response" }],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns InvalidResponse when no valid fees exist", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: [{ notAFee: 100 }, { invalidEntry: true }] },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidResponse");
    }
  });

  it("returns transport SDK error as-is", async () => {
    const clock = createFakeClock(0);
    const testError = createSdkError("Timeout", "Request timed out");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        ["getRecentPrioritizationFees", { error: testError }],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(0);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("Timeout");
      expect(result.error).toBe(testError);
    }
  });

  it("maps unknown thrown transport error", async () => {
    const clock = createFakeClock(0);
    const throwingTransport: RpcTransport = {
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      async send() {
        throw new Error("fetch failed");
      },
    };

    const provider = createRpcPriorityFeeProvider(throwingTransport, clock);
    const result = await provider.getEstimate(0);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("NetworkError");
    }
  });

  it("uses clock timestamp", async () => {
    const clock = createFakeClock(12345);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: [{ prioritizationFee: 100 }] },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    const result = await provider.getEstimate(clock.now());

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.fetchedAtMs).toBe(12345);
    }
  });

  it("does not throw", async () => {
    const clock = createFakeClock(0);
    const transport = createFakeRpcTransport({
      endpointUrl: "https://test",
      endpointId: "test",
      responses: new Map([
        [
          "getRecentPrioritizationFees",
          { success: [{ prioritizationFee: 100 }] },
        ],
      ]),
    });

    const provider = createRpcPriorityFeeProvider(transport, clock);
    await expect(provider.getEstimate(0)).resolves.toBeDefined();
  });
});

describe("isPriorityFeeStale", () => {
  it("returns false when estimate age is below max stale age", () => {
    const estimate: PriorityFeeEstimate = {
      priorityFeeMicroLamports: 100,
      source: "test",
      fetchedAtMs: 0,
    };

    const result = isPriorityFeeStale(estimate, 25, 50);
    expect(result).toBe(false);
  });

  it("returns false when estimate age equals max stale age", () => {
    const estimate: PriorityFeeEstimate = {
      priorityFeeMicroLamports: 100,
      source: "test",
      fetchedAtMs: 0,
    };

    const result = isPriorityFeeStale(estimate, 50, 50);
    expect(result).toBe(false);
  });

  it("returns true when estimate age is greater than max stale age", () => {
    const estimate: PriorityFeeEstimate = {
      priorityFeeMicroLamports: 100,
      source: "test",
      fetchedAtMs: 0,
    };

    const result = isPriorityFeeStale(estimate, 101, 50);
    expect(result).toBe(true);
  });

  it("returns false for negative elapsed time", () => {
    const estimate: PriorityFeeEstimate = {
      priorityFeeMicroLamports: 100,
      source: "test",
      fetchedAtMs: 100,
    };

    const result = isPriorityFeeStale(estimate, 50, 50);
    expect(result).toBe(false);
  });
});

describe("getPriorityFeeEstimate", () => {
  it("returns first fresh successful provider estimate", async () => {
    const clock = createFakeClock(0);

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 100,
          source: "provider1",
          fetchedAtMs: clock.now(),
        });
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 200,
          source: "provider2",
          fetchedAtMs: clock.now(),
        });
      },
    };

    const result = await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.source).toBe("provider1");
      expect(result.value.priorityFeeMicroLamports).toBe(100);
    }
  });

  it("skips failed provider", async () => {
    const clock = createFakeClock(0);

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        return err(createSdkError("NetworkError", "Provider failed"));
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 200,
          source: "provider2",
          fetchedAtMs: clock.now(),
        });
      },
    };

    const result = await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.source).toBe("provider2");
    }
  });

  it("skips thrown provider", async () => {
    const clock = createFakeClock(0);

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        throw new Error("Unexpected error");
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 200,
          source: "provider2",
          fetchedAtMs: clock.now(),
        });
      },
    };

    const result = await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.source).toBe("provider2");
    }
  });

  it("skips stale provider", async () => {
    const clock = createFakeClock(0);

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 100,
          source: "provider1",
          fetchedAtMs: clock.now() - 2000, // Stale (2000ms old)
        });
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 200,
          source: "provider2",
          fetchedAtMs: clock.now(),
        });
      },
    };

    const result = await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.source).toBe("provider2");
    }
  });

  it("queries providers in order", async () => {
    const clock = createFakeClock(0);
    const calls: string[] = [];

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        calls.push("provider1");
        return err(createSdkError("NetworkError", "Failed"));
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        calls.push("provider2");
        return err(createSdkError("NetworkError", "Failed"));
      },
    };

    await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(calls).toEqual(["provider1", "provider2"]);
  });

  it("stops after first fresh success", async () => {
    const clock = createFakeClock(0);
    const calls: string[] = [];

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        calls.push("provider1");
        return ok({
          priorityFeeMicroLamports: 100,
          source: "provider1",
          fetchedAtMs: clock.now(),
        });
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        calls.push("provider2");
        return ok({
          priorityFeeMicroLamports: 200,
          source: "provider2",
          fetchedAtMs: clock.now(),
        });
      },
    };

    await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(calls).toEqual(["provider1"]);
  });

  it("falls back when providers array is empty", async () => {
    const clock = createFakeClock(0);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: 1000, fallbackMicroLamports: 75 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(75);
      expect(result.value.source).toBe("fallback");
    }
  });

  it("falls back when all providers fail", async () => {
    const clock = createFakeClock(0);

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        return err(createSdkError("NetworkError", "Failed"));
      },
    };

    const provider2: PriorityFeeProvider = {
      name: "provider2",
      async getEstimate() {
        return err(createSdkError("NetworkError", "Failed"));
      },
    };

    const result = await getPriorityFeeEstimate(
      [provider1, provider2],
      { maxStaleMs: 1000, fallbackMicroLamports: 60 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(60);
      expect(result.value.source).toBe("fallback");
    }
  });

  it("falls back when all providers are stale", async () => {
    const clock = createFakeClock(5000);

    const provider1: PriorityFeeProvider = {
      name: "provider1",
      async getEstimate() {
        return ok({
          priorityFeeMicroLamports: 100,
          source: "provider1",
          fetchedAtMs: 0, // Very stale (5000ms old)
        });
      },
    };

    const result = await getPriorityFeeEstimate(
      [provider1],
      { maxStaleMs: 1000, fallbackMicroLamports: 55 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(55);
      expect(result.value.source).toBe("fallback");
    }
  });

  it("fallback uses source 'fallback'", async () => {
    const clock = createFakeClock(0);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.source).toBe("fallback");
    }
  });

  it("fallback uses clock timestamp", async () => {
    const clock = createFakeClock(9999);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: 1000, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.fetchedAtMs).toBe(9999);
    }
  });

  it("allows zero fallback fee", async () => {
    const clock = createFakeClock(0);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: 1000, fallbackMicroLamports: 0 },
      clock,
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.priorityFeeMicroLamports).toBe(0);
    }
  });

  it("returns InvalidConfig for negative fallback fee", async () => {
    const clock = createFakeClock(0);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: 1000, fallbackMicroLamports: -100 },
      clock,
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("returns InvalidConfig for non-finite fallback fee", async () => {
    const clock = createFakeClock(0);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: 1000, fallbackMicroLamports: Infinity },
      clock,
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("returns InvalidConfig for negative maxStaleMs", async () => {
    const clock = createFakeClock(0);

    const result = await getPriorityFeeEstimate(
      [],
      { maxStaleMs: -100, fallbackMicroLamports: 50 },
      clock,
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("InvalidConfig");
    }
  });

  it("does not throw", async () => {
    const clock = createFakeClock(0);

    await expect(
      getPriorityFeeEstimate([], { maxStaleMs: 1000, fallbackMicroLamports: 50 }, clock),
    ).resolves.toBeDefined();
  });
});
