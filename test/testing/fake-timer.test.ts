/**
 * Tests for fake timer implementation.
 */

import { describe, it, expect, vi } from "vitest";
import { createFakeTimer } from "../../src/testing/fake-timer.js";
import { createFakeClock } from "../../src/testing/fake-clock.js";

describe("FakeTimer", () => {
  it("starts with zero pending callbacks", () => {
    const timer = createFakeTimer();
    expect(timer.pendingCount()).toBe(0);
  });

  it("setTimeout increases pending count", () => {
    const timer = createFakeTimer();
    timer.setTimeout(() => {}, 100);
    expect(timer.pendingCount()).toBe(1);

    timer.setTimeout(() => {}, 50);
    expect(timer.pendingCount()).toBe(2);
  });

  it("clearTimeout removes pending callback", () => {
    const timer = createFakeTimer();
    const handle = timer.setTimeout(() => {}, 100);
    expect(timer.pendingCount()).toBe(1);

    timer.clearTimeout(handle);
    expect(timer.pendingCount()).toBe(0);
  });

  it("flushAll executes all pending callbacks", () => {
    const timer = createFakeTimer();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    timer.setTimeout(callback1, 100);
    timer.setTimeout(callback2, 50);

    expect(timer.pendingCount()).toBe(2);

    timer.flushAll();

    expect(callback1).toHaveBeenCalledOnce();
    expect(callback2).toHaveBeenCalledOnce();
    expect(timer.pendingCount()).toBe(0);
  });

  it("flushAll removes executed callbacks from queue", () => {
    const timer = createFakeTimer();
    timer.setTimeout(() => {}, 100);
    timer.flushAll();
    expect(timer.pendingCount()).toBe(0);
  });

  it("advanceAndFlush advances clock and executes due callbacks", () => {
    const timer = createFakeTimer();
    const clock = createFakeClock(0);
    const callback = vi.fn();

    timer.setTimeout(callback, 100);

    // Advance 50ms: callback not yet due
    timer.advanceAndFlush(50, clock);
    expect(callback).not.toHaveBeenCalled();
    expect(timer.pendingCount()).toBe(1);

    // Advance 50ms more: callback now due
    timer.advanceAndFlush(50, clock);
    expect(callback).toHaveBeenCalledOnce();
    expect(timer.pendingCount()).toBe(0);
  });

  it("callbacks scheduled for future remain pending after advanceAndFlush", () => {
    const timer = createFakeTimer();
    const clock = createFakeClock(0);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    timer.setTimeout(callback1, 50);
    timer.setTimeout(callback2, 150);

    timer.advanceAndFlush(100, clock);

    expect(callback1).toHaveBeenCalledOnce();
    expect(callback2).not.toHaveBeenCalled();
    expect(timer.pendingCount()).toBe(1);
  });

  it("callbacks execute in order of scheduling", () => {
    const timer = createFakeTimer();
    const order: number[] = [];

    timer.setTimeout(() => order.push(1), 100);
    timer.setTimeout(() => order.push(2), 50);
    timer.setTimeout(() => order.push(3), 150);

    timer.flushAll();
    expect(order).toEqual([1, 2, 3]);
  });
});
