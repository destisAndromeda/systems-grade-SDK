/**
 * Integration test for final SDK demo.
 *
 * Tests the judge demo showing the complete SDK reliability story.
 */

import { describe, it, expect } from "vitest";
import { runJudgeDemo } from "../../examples/judge-demo.js";

describe("Judge Demo Integration", () => {
  it("runs successfully", async () => {
    const result = await runJudgeDemo();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("shows MVP demo title", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("DEMO")).toBe(true);
  });

  it("shows fallback success narrative", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("fallback") || result.includes("Fallback")).toBe(true);
  });

  it("shows confirmation success", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("Confirm") || result.includes("confirm")).toBe(true);
  });

  it("records metrics", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("Metric") || result.includes("metric")).toBe(true);
  });

  it("demonstrates resilience features", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("Resilience") || result.includes("RESILIENCE")).toBe(true);
  });

  it("includes endpoint health reporting", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("Health") || result.includes("health")).toBe(true);
  });

  it("shows circuit breaker information", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("circuit") || result.includes("Circuit")).toBe(true);
  });

  it("includes retry policy information", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("Retry") || result.includes("retry")).toBe(true);
  });

  it("demonstrates transaction flow", async () => {
    const result = await runJudgeDemo();
    // Should mention transaction sending and confirmation
    expect(result.includes("transact") || result.includes("STEP")).toBe(true);
  });

  it("includes key outcomes section", async () => {
    const result = await runJudgeDemo();
    expect(result.includes("OUTCOMES") || result.includes("KEY")).toBe(true);
  });

  it("provides bounty judge context", async () => {
    const result = await runJudgeDemo();
    expect(
      result.includes("BOUNTY") ||
      result.includes("bounty") ||
      result.includes("judge") ||
      result.includes("JUDGE")
    ).toBe(true);
  });

  it("completes quickly (no real network)", async () => {
    const start = Date.now();
    await runJudgeDemo();
    const elapsed = Date.now() - start;

    // Should complete in less than 1 second (no real network)
    expect(elapsed).toBeLessThan(1000);
  });

  it("is deterministic (consistent structure)", async () => {
    const result1 = await runJudgeDemo();
    const result2 = await runJudgeDemo();

    // Both should have the same major sections and approximately same length
    expect(result1.split("STEP").length).toBe(result2.split("STEP").length);
    expect(Math.abs(result1.length - result2.length)).toBeLessThan(100);
  });

  it("includes multiple endpoints in scenario", async () => {
    const result = await runJudgeDemo();
    // Should mention multiple endpoints for fallback
    expect(
      result.includes("Primary") ||
      result.includes("primary") ||
      result.includes("endpoint")
    ).toBe(true);
  });

  it("shows what SDK features are demonstrated", async () => {
    const result = await runJudgeDemo();
    expect(
      result.includes("Transaction") ||
      result.includes("transaction") ||
      result.includes("send")
    ).toBe(true);
  });
});
