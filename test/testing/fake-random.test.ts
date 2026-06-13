/**
 * Tests for fake random source implementation.
 */

import { describe, it, expect } from "vitest";
import { createFakeRandom } from "../../src/testing/fake-random.js";

describe("FakeRandom", () => {
  it("returns default value when queue is empty", () => {
    const random = createFakeRandom(0.5);
    expect(random.next()).toBe(0.5);
  });

  it("defaults to 0 when no default value provided", () => {
    const random = createFakeRandom();
    expect(random.next()).toBe(0);
  });

  it("returns scripted sequence in order", () => {
    const random = createFakeRandom(0);
    random.pushSequence([0.1, 0.2, 0.3]);
    expect(random.next()).toBe(0.1);
    expect(random.next()).toBe(0.2);
    expect(random.next()).toBe(0.3);
  });

  it("returns default value after sequence exhausted", () => {
    const random = createFakeRandom(0.99);
    random.pushSequence([0.5]);
    expect(random.next()).toBe(0.5);
    expect(random.next()).toBe(0.99);
    expect(random.next()).toBe(0.99);
  });

  it("multiple pushSequence calls append to queue", () => {
    const random = createFakeRandom(0);
    random.pushSequence([0.1, 0.2]);
    random.pushSequence([0.3, 0.4]);
    expect(random.next()).toBe(0.1);
    expect(random.next()).toBe(0.2);
    expect(random.next()).toBe(0.3);
    expect(random.next()).toBe(0.4);
  });
});
