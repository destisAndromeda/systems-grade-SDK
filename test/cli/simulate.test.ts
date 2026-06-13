/**
 * Tests for CLI simulate command.
 */

import { describe, it, expect } from "vitest";
import { runSimulation } from "../../src/cli/simulate.js";

describe("runSimulation", () => {
  it("returns text output", async () => {
    const result = await runSimulation();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("mentions Simulation complete in output", async () => {
    const result = await runSimulation();
    expect(result).toContain("Simulation Complete");
  });

  it("mentions RPC fallback in output", async () => {
    const result = await runSimulation();
    expect(result.includes("fallback") || result.includes("Fallback")).toBe(true);
  });

  it("includes signature or error information in output", async () => {
    const result = await runSimulation();
    expect(
      result.includes("Signature") ||
      result.includes("signature") ||
      result.includes("Result") ||
      result.includes("Error")
    ).toBe(true);
  });

  it("includes metrics count information", async () => {
    const result = await runSimulation();
    expect(result.includes("Metrics") || result.includes("metric")).toBe(true);
  });

  it("shows endpoint health information", async () => {
    const result = await runSimulation();
    expect(result.includes("Health") || result.includes("health")).toBe(true);
  });

  it("shows step-by-step simulation progress", async () => {
    const result = await runSimulation();
    expect(result).toContain("Step");
  });

  it("completes quickly (no real network calls)", async () => {
    const start = Date.now();
    await runSimulation();
    const elapsed = Date.now() - start;

    // Should complete in less than 1 second (no real network)
    expect(elapsed).toBeLessThan(1000);
  });

  it("includes endpoint configuration information", async () => {
    const result = await runSimulation();
    expect(result.includes("mainnet") || result.includes("endpoint")).toBe(true);
  });

  it("is deterministic (produces consistent output structure)", async () => {
    const result1 = await runSimulation();
    const result2 = await runSimulation();

    // Both should have the same major sections
    expect(result1).toContain("Step");
    expect(result2).toContain("Step");
    expect(result1.split("Step").length).toBe(result2.split("Step").length);
  });
});
