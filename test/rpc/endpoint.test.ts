/**
 * Tests for RPC endpoint utilities.
 */

import { describe, it } from "vitest";
import { normalizeRpcEndpointConfig, createEndpointId } from "../../src/rpc/endpoint";

describe("normalizeRpcEndpointConfig", () => {
  it("converts URL string to default config", () => {
    // TODO: assert normalizeRpcEndpointConfig("https://api.com") returns ok with weight=1
  });

  it("returns error for empty URL string", () => {
    // TODO: assert normalizeRpcEndpointConfig("") returns err(InvalidConfig)
  });

  it("preserves fields from object config", () => {
    // TODO: pass { url: "...", weight: 2 }, assert result includes both
  });

  it("fills in default values", () => {
    // TODO: assert normalized config has weight and other defaults
  });
});

describe("createEndpointId", () => {
  it("creates stable ID for same URL", () => {
    // TODO: create ID twice for same URL, assert they match
  });

  it("normalizes trailing slashes", () => {
    // TODO: create IDs for "https://api.com" and "https://api.com/", assert they match
  });

  it("creates different IDs for different URLs", () => {
    // TODO: assert ID for "https://api1.com" !== ID for "https://api2.com"
  });
});
