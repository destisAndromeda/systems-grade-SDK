/**
 * Tests for clock implementations.
 */

import { describe, it } from "vitest";
import { createFakeClock } from "../../src/testing/fake-clock";

describe("createFakeClock", () => {
  it("starts with initial time", () => {
    // TODO: assert clock.now() returns start time (0 by default)
  });

  it("advance() moves time forward", () => {
    // TODO: create clock, advance(100), assert now() increased by 100
  });

  it("set() sets absolute time", () => {
    // TODO: create clock, set(500), assert now() === 500
  });

  it("advances correctly through multiple increments", () => {
    // TODO: advance 100, then 50, assert now() === 150
  });
});
