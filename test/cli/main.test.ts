import { describe, it, expect, vi } from "vitest";
import { createCli } from "../../src/cli/main.js";
import * as healthModule from "../../src/cli/health.js";
import * as statusModule from "../../src/cli/status.js";
import * as simulateModule from "../../src/cli/simulate.js";

describe("CLI Commander Main Entrypoint", () => {
  it("registers health command", () => {
    const program = createCli();
    const healthCmd = program.commands.find((c) => c.name() === "health");
    expect(healthCmd).toBeDefined();
    expect(healthCmd?.description()).toContain("Check RPC endpoint health");
  });

  it("registers status command", () => {
    const program = createCli();
    const statusCmd = program.commands.find((c) => c.name() === "status");
    expect(statusCmd).toBeDefined();
    expect(statusCmd?.description()).toContain("Fetch transaction status");
  });

  it("registers simulate command", () => {
    const program = createCli();
    const simulateCmd = program.commands.find((c) => c.name() === "simulate");
    expect(simulateCmd).toBeDefined();
    expect(simulateCmd?.description()).toContain("Run network failure simulation");
  });

  it("health command calls health report handler", async () => {
    const spy = vi.spyOn(healthModule, "createHealthReport").mockResolvedValue("mocked health report");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const program = createCli();
    await program.parseAsync(["node", "solana-sdk", "health", "https://api.test"]);

    expect(spy).toHaveBeenCalledWith(["https://api.test"], expect.objectContaining({
      iterations: 3,
    }));
    expect(consoleSpy).toHaveBeenCalledWith("mocked health report");

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("status command requires endpoint option", async () => {
    const program = createCli().exitOverride();
    await expect(
      program.parseAsync(["node", "solana-sdk", "status", "some-signature"])
    ).rejects.toThrow();
  });

  it("simulate command runs without real RPC", async () => {
    const spy = vi.spyOn(simulateModule, "runSimulation").mockResolvedValue("mocked simulation report");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const program = createCli();
    await program.parseAsync(["node", "solana-sdk", "simulate"]);

    expect(spy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith("mocked simulation report");

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("health command with --watch calls watchHealth", async () => {
    const spy = vi.spyOn(healthModule, "watchHealth").mockResolvedValue(undefined);

    const program = createCli();
    await program.parseAsync([
      "node",
      "solana-sdk",
      "health",
      "https://api.test",
      "--watch",
      "--interval-ms",
      "1000",
      "--iterations",
      "5",
    ]);

    expect(spy).toHaveBeenCalledWith(
      ["https://api.test"],
      expect.objectContaining({
        intervalMs: 1000,
        iterations: 5,
      }),
    );

    spy.mockRestore();
  });

  it("status command with endpoint calls createTransactionStatusReport", async () => {
    const spy = vi.spyOn(statusModule, "createTransactionStatusReport").mockResolvedValue("mocked status report");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const program = createCli();
    await program.parseAsync([
      "node",
      "solana-sdk",
      "status",
      "some-signature",
      "--endpoint",
      "https://api.test",
    ]);

    expect(spy).toHaveBeenCalledWith("some-signature", "https://api.test");
    expect(consoleSpy).toHaveBeenCalledWith("mocked status report");

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

});

