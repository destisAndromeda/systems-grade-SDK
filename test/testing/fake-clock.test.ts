/**
 * Tests for fake clock implementation.
 */

import { describe, it, expect } from "vitest";
import { createFakeClock } from "../../src/testing/fake-clock.js";

describe("FakeClock", () => {
  it("defaults to starting time of 0", () => {
    const clock = createFakeClock();
    expect(clock.now()).toBe(0);
  });

  it("starts with custom initial time", () => {
    const clock = createFakeClock(1234);
    expect(clock.now()).toBe(1234);
  });

  it("advance() increases time by specified amount", () => {
    const clock = createFakeClock(0);
    clock.advance(100);
    expect(clock.now()).toBe(100);
  });

  it("set() sets absolute time", () => {
    const clock = createFakeClock(50);
    clock.set(200);
    expect(clock.now()).toBe(200);
  });

  it("multiple advances accumulate", () => {
    const clock = createFakeClock(0);
    clock.advance(100);
    clock.advance(50);
    clock.advance(25);
    expect(clock.now()).toBe(175);
  });

  it("set() overwrites accumulated time", () => {
    const clock = createFakeClock(0);
    clock.advance(100);
    clock.advance(50);
    clock.set(0);
    expect(clock.now()).toBe(0);
  });
});
