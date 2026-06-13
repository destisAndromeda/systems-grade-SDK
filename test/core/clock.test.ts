/**
 * Tests for clock implementations.
 */

import { describe, it, expect } from "vitest";
import { createFakeClock } from "../../src/testing/fake-clock.js";

describe("createFakeClock", () => {
  it("starts with initial time", () => {
    const clock = createFakeClock();
    expect(clock.now()).toBe(0);
  });

  it("starts with custom time", () => {
    const clock = createFakeClock(123);
    expect(clock.now()).toBe(123);
  });

  it("advance() moves time forward", () => {
    const clock = createFakeClock(0);
    clock.advance(100);
    expect(clock.now()).toBe(100);
  });

  it("set() sets absolute time", () => {
    const clock = createFakeClock(100);
    clock.set(500);
    expect(clock.now()).toBe(500);
  });

  it("advances correctly through multiple increments", () => {
    const clock = createFakeClock(0);
    clock.advance(100);
    clock.advance(50);
    expect(clock.now()).toBe(150);
  });

  it("set() overwrites previous time", () => {
    const clock = createFakeClock(0);
    clock.advance(100);
    clock.set(25);
    expect(clock.now()).toBe(25);
  });
});
