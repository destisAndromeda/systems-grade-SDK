/**
 * Tests for random source implementations.
 */

import { describe, it } from "vitest";
import { createFakeRandom } from "../../src/testing/fake-random.js";

describe("createFakeRandom", () => {
  it("returns scripted sequence of values", () => {
    // TODO: create random, pushSequence([0.5, 0.3]), assert next() returns those values
  });

  it("returns default value after sequence exhausted", () => {
    // TODO: pushSequence([0.5]), call next() twice, assert second call returns defaultValue
  });

  it("defaults to 0 if no default provided", () => {
    // TODO: create random without default, exhaustSequence, assert next() === 0
  });

  it("supports multiple pushSequence calls", () => {
    // TODO: push two separate sequences, assert they concatenate
  });
});
