/**
 * Tests for clock implementations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createSystemClock } from "../../src/core/clock.js";

describe("createSystemClock", () => {
  it("returns a number from now()", () => {
    const clock = createSystemClock();
    const now = clock.now();
    expect(typeof now).toBe("number");
  });

  it("now() returns approximately current Date.now()", () => {
    const clock = createSystemClock();
    const before = Date.now();
    const clockTime = clock.now();
    const after = Date.now();

    // Allow a small range for execution time
    expect(clockTime).toBeGreaterThanOrEqual(before - 100);
    expect(clockTime).toBeLessThanOrEqual(after + 100);
  });

  it("now() increases over time", () => {
    const clock = createSystemClock();
    const t1 = clock.now();
    // Small delay to ensure time passes
    const t2 = clock.now();
    expect(t2 >= t1).toBe(true);
  });

  it("returns valid Unix timestamp", () => {
    const clock = createSystemClock();
    const now = clock.now();
    // Valid Unix timestamp should be after year 2000 (946684800000) and before year 2100
    expect(now).toBeGreaterThan(946684800000);
    expect(now).toBeLessThan(4102444800000);
  });
});
