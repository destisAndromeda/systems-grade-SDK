/**
 * Fake relay client for testing.
 *
 * Allows tests to mock relay responses.
 */

import type { RelayClient } from "../relay/types.js";
import type { PreparedTransaction } from "../tx/types.js";
import type { Result } from "../core/result.js";

/**
 * Create a fake relay client for testing.
 *
 * @param config.name Relay name
 * @param config.signaturePrefix Prefix for generated signatures (for identification)
 * @param config.failureError If set, relay will fail with this error
 * @returns Fake relay client
 */
export function createFakeRelayClient(config?: {
  name?: string;
  signaturePrefix?: string;
  failureError?: Error;
}): RelayClient {
  // TODO: create relay client that returns fake signatures or configured error
  throw new Error("TODO");
}
