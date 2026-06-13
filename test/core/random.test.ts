/**
 * Tests for random source implementations.
 */

import { describe, it, expect } from "vitest";
import { createFakeRandom } from "../../src/testing/fake-random.js";

describe("createFakeRandom", () => {
  it("returns scripted sequence of values", () => {
    const random = createFakeRandom();
    random.pushSequence([0.5, 0.3, 0.9]);
    expect(random.next()).toBe(0.5);
    expect(random.next()).toBe(0.3);
    expect(random.next()).toBe(0.9);
  });

  it("returns default value after sequence exhausted", () => {
    const random = createFakeRandom(0.42);
    random.pushSequence([0.5]);
    expect(random.next()).toBe(0.5);
    expect(random.next()).toBe(0.42);
    expect(random.next()).toBe(0.42);
  });

  it("defaults to 0 if no default provided", () => {
    const random = createFakeRandom();
    random.pushSequence([0.5]);
    expect(random.next()).toBe(0.5);
    expect(random.next()).toBe(0);
  });

  it("supports multiple pushSequence calls", () => {
    const random = createFakeRandom();
    random.pushSequence([0.1, 0.2]);
    random.pushSequence([0.3, 0.4]);
    expect(random.next()).toBe(0.1);
    expect(random.next()).toBe(0.2);
    expect(random.next()).toBe(0.3);
    expect(random.next()).toBe(0.4);
  });

  it("returns default after multiple sequences", () => {
    const random = createFakeRandom(0.99);
    random.pushSequence([0.1]);
    random.pushSequence([0.2]);
    expect(random.next()).toBe(0.1);
    expect(random.next()).toBe(0.2);
    expect(random.next()).toBe(0.99);
  });
});
