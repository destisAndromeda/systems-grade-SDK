/**
 * Tests for random source implementations.
 */

import { describe, it, expect } from "vitest";
import { createMathRandomSource } from "../../src/core/random.js";

describe("createMathRandomSource", () => {
  it("returns a number from next()", () => {
    const random = createMathRandomSource();
    const value = random.next();
    expect(typeof value).toBe("number");
  });

  it("next() returns values in range [0, 1)", () => {
    const random = createMathRandomSource();
    for (let i = 0; i < 10; i++) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("generates different values across calls", () => {
    const random = createMathRandomSource();
    const values = new Set<number>();
    for (let i = 0; i < 10; i++) {
      values.add(random.next());
    }
    // With high probability, we should get at least 2 different values from 10 calls
    expect(values.size).toBeGreaterThan(1);
  });
});
