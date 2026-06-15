import { describe, it, expect } from "vitest";
import { buildVerifiedEndpointPool } from "../../src/rpc/genesis-guard.js";
import type { GenesisGuardEndpoint, GenesisGuardTransport } from "../../src/rpc/genesis-guard.js";

describe("genesis-guard", () => {
  it("keeps all endpoints when genesis hashes match", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      ["ep1", { send: async () => "genesis-hash-A" } as any],
      ["ep2", { send: async () => "genesis-hash-A" } as any],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);

    expect(result.valid).toEqual(endpoints);
    expect(result.quarantined).toEqual([]);
    expect(result.genesisHash).toBe("genesis-hash-A");
    expect(result.warning).toBeUndefined();
  });

  it("chooses majority genesis hash", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
      { id: "ep3", url: "http://ep3.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      ["ep1", { send: async () => "genesis-hash-A" } as any],
      ["ep2", { send: async () => "genesis-hash-B" } as any],
      ["ep3", { send: async () => "genesis-hash-A" } as any],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);

    expect(result.valid).toEqual([
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep3", url: "http://ep3.com" },
    ]);
    expect(result.quarantined).toEqual([
      { id: "ep2", url: "http://ep2.com" },
    ]);
    expect(result.genesisHash).toBe("genesis-hash-A");
    expect(result.warning).toBe(
      "Quarantined 1 RPC endpoint(s) with non-majority or unverifiable genesis hash",
    );
  });

  it("quarantines endpoints from another network", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      ["ep1", { send: async () => "genesis-hash-A" } as any],
      ["ep2", { send: async () => "genesis-hash-B" } as any],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);

    expect(result.valid.length).toBe(1);
    expect(result.quarantined.length).toBe(1);
    expect(result.warning).toBe(
      "Quarantined 1 RPC endpoint(s) with non-majority or unverifiable genesis hash",
    );
  });

  it("quarantines endpoints whose genesis cannot be verified", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      ["ep1", { send: async () => "genesis-hash-A" } as any],
      [
        "ep2",
        {
          send: async () => {
            throw new Error("Network error");
          },
        } as any,
      ],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);

    expect(result.valid).toEqual([{ id: "ep1", url: "http://ep1.com" }]);
    expect(result.quarantined).toEqual([{ id: "ep2", url: "http://ep2.com" }]);
    expect(result.genesisHash).toBe("genesis-hash-A");
    expect(result.warning).toBe(
      "Quarantined 1 RPC endpoint(s) with non-majority or unverifiable genesis hash",
    );
  });

  it("preserves valid endpoint order", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
      { id: "ep3", url: "http://ep3.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      ["ep1", { send: async () => "genesis-hash-A" } as any],
      ["ep2", { send: async () => "genesis-hash-B" } as any],
      ["ep3", { send: async () => "genesis-hash-A" } as any],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);

    expect(result.valid).toEqual([
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep3", url: "http://ep3.com" },
    ]);
  });

  it("returns warning when endpoints are quarantined", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      ["ep1", { send: async () => "genesis-hash-A" } as any],
      ["ep2", { send: async () => "genesis-hash-B" } as any],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);
    expect(result.warning).toContain("Quarantined 1 RPC endpoint(s)");
  });

  it("handles empty endpoint list", async () => {
    const result = await buildVerifiedEndpointPool([], new Map());
    expect(result.valid).toEqual([]);
    expect(result.quarantined).toEqual([]);
    expect(result.warning).toBeUndefined();
  });

  it("handles no successful genesis responses without crashing", async () => {
    const endpoints: GenesisGuardEndpoint[] = [
      { id: "ep1", url: "http://ep1.com" },
      { id: "ep2", url: "http://ep2.com" },
    ];

    const transports = new Map<string, GenesisGuardTransport>([
      [
        "ep1",
        {
          send: async () => {
            throw new Error("Failed");
          },
        } as any,
      ],
      [
        "ep2",
        {
          send: async () => {
            throw new Error("Failed");
          },
        } as any,
      ],
    ]);

    const result = await buildVerifiedEndpointPool(endpoints, transports);

    expect(result.valid).toEqual(endpoints);
    expect(result.quarantined).toEqual([]);
    expect(result.warning).toBe(
      "Quarantined 0 RPC endpoint(s) with non-majority or unverifiable genesis hash",
    );
  });
});
