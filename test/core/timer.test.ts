/**
 * Tests for timer implementations.
 */

import { describe, it, expect } from "vitest";
import { createFakeTimer } from "../../src/testing/fake-timer.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";

describe("createFakeTimer", () => {
  it("starts with no pending callbacks", () => {
    const timer = createFakeTimer();
    expect(timer.pendingCount()).toBe(0);
  });

  it("schedules callback via setTimeout", () => {
    const timer = createFakeTimer();
    timer.setTimeout(() => {}, 100);
    expect(timer.pendingCount()).toBe(1);
  });

  it("clears scheduled callback via clearTimeout", () => {
    const timer = createFakeTimer();
    const handle = timer.setTimeout(() => {}, 100);
    expect(timer.pendingCount()).toBe(1);
    timer.clearTimeout(handle);
    expect(timer.pendingCount()).toBe(0);
  });

  it("flushAll() executes all pending callbacks", () => {
    const timer = createFakeTimer();
    let count = 0;
    timer.setTimeout(() => {
      count++;
    }, 100);
    timer.setTimeout(() => {
      count++;
    }, 50);
    expect(timer.pendingCount()).toBe(2);
    timer.flushAll();
    expect(count).toBe(2);
    expect(timer.pendingCount()).toBe(0);
  });

  it("advanceAndFlush() executes callbacks within delay", () => {
    const timer = createFakeTimer();
    const clock = createFakeClock(0);
    let count = 0;

    timer.setTimeout(() => {
      count++;
    }, 100);

    timer.advanceAndFlush(50, clock);
    expect(count).toBe(0);

    timer.advanceAndFlush(50, clock);
    expect(count).toBe(1);
  });

  it("callbacks execute in order of scheduling", () => {
    const timer = createFakeTimer();
    const order: number[] = [];

    timer.setTimeout(() => {
      order.push(1);
    }, 100);
    timer.setTimeout(() => {
      order.push(2);
    }, 50);
    timer.setTimeout(() => {
      order.push(3);
    }, 150);

    timer.flushAll();
    expect(order).toEqual([1, 2, 3]);
  });

  it("handles multiple schedules and clears", () => {
    const timer = createFakeTimer();
    let count = 0;

    const h1 = timer.setTimeout(() => {
      count++;
    }, 100);
    const h2 = timer.setTimeout(() => {
      count++;
    }, 50);

    timer.clearTimeout(h1);
    timer.flushAll();
    expect(count).toBe(1);
  });
});
