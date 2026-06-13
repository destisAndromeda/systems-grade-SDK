/**
 * Tests for timer implementations.
 */

import { describe, it } from "vitest";
import { createFakeTimer } from "../../src/testing/fake-timer";
import { createFakeClock } from "../../src/testing/fake-clock";

describe("createFakeTimer", () => {
  it("schedules callback via setTimeout", () => {
    // TODO: schedule callback, assert pendingCount() === 1
  });

  it("clears scheduled callback via clearTimeout", () => {
    // TODO: schedule callback, clear it, assert pendingCount() === 0
  });

  it("flushAll() executes all pending callbacks", () => {
    // TODO: schedule 2 callbacks, flushAll, assert both were called
  });

  it("advanceAndFlush() executes callbacks within delay", () => {
    // TODO: schedule callback at 100ms, advanceAndFlush(50), assert not called,
    // advanceAndFlush(50), assert called
  });

  it("callbacks execute in order of scheduling", () => {
    // TODO: schedule 3 callbacks, flushAll, verify execution order
  });
});
