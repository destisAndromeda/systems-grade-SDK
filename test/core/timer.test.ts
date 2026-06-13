/**
 * Tests for timer implementations.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createSystemTimer } from "../../src/core/timer.js";

describe("createSystemTimer", () => {
  afterEach(() => {
    vi.clearAllTimers();
  });

  it("exposes setTimeout method", () => {
    const timer = createSystemTimer();
    expect(typeof timer.setTimeout).toBe("function");
  });

  it("exposes clearTimeout method", () => {
    const timer = createSystemTimer();
    expect(typeof timer.clearTimeout).toBe("function");
  });

  it("setTimeout returns a handle", () => {
    const timer = createSystemTimer();
    const handle = timer.setTimeout(() => {}, 100);
    expect(handle).toBeDefined();
    timer.clearTimeout(handle);
  });

  it("schedules callback with setTimeout", async () => {
    vi.useFakeTimers();
    const timer = createSystemTimer();
    const callback = vi.fn();

    timer.setTimeout(callback, 100);

    await vi.advanceTimersByTimeAsync(100);

    expect(callback).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("clearTimeout prevents callback execution", async () => {
    vi.useFakeTimers();
    const timer = createSystemTimer();
    const callback = vi.fn();

    const handle = timer.setTimeout(callback, 100);
    timer.clearTimeout(handle);

    await vi.advanceTimersByTimeAsync(100);

    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("supports multiple timeouts", async () => {
    vi.useFakeTimers();
    const timer = createSystemTimer();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    timer.setTimeout(callback1, 50);
    timer.setTimeout(callback2, 100);

    await vi.advanceTimersByTimeAsync(50);
    expect(callback1).toHaveBeenCalledOnce();
    expect(callback2).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(callback2).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
