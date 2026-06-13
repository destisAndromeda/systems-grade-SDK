/**
 * Tests for SDK creation and validation.
 */

import { describe, it } from "vitest";
import { validateSdkConfig, createSolanaReliabilitySdk } from "../../src/sdk/create-sdk";

describe("validateSdkConfig", () => {
  it("accepts valid config with endpoints", () => {
    // TODO: assert validateSdkConfig({ rpcEndpoints: ["https://api.com"] }) returns ok
  });

  it("rejects empty endpoints array", () => {
    // TODO: assert validateSdkConfig({ rpcEndpoints: [] }) returns err
  });

  it("rejects invalid retry config", () => {
    // TODO: config with maxAttempts=0, assert err
  });

  it("rejects invalid circuit breaker config", () => {
    // TODO: config with failureThreshold=0, assert err
  });
});

describe("createSolanaReliabilitySdk", () => {
  it("creates SDK with valid config", async () => {
    // TODO: createSolanaReliabilitySdk with valid config,
    // assert ok result with SDK facade methods
  });

  it("returns error for invalid config", async () => {
    // TODO: createSolanaReliabilitySdk with invalid config,
    // assert err(InvalidConfig)
  });

  it("initializes with default values for optional config", async () => {
    // TODO: create SDK with minimal config (just endpoints),
    // assert defaults filled in correctly
  });
});
