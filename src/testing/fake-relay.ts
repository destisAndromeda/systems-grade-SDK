/**
 * Fake relay client for testing.
 *
 * Allows tests to mock relay responses without making real network calls.
 */

import type { RelayClient, RelaySendResult } from "../relay/types.js";
import type { SdkError } from "../core/error.js";

interface FakeRelayCall {
  base64: string;
}

/**
 * Configuration for a fake relay client.
 */
export interface FakeRelayClientConfig {
  name?: string;
  signature?: string;
  error?: SdkError;
}

/**
 * Create a fake relay client for testing.
 *
 * @param config Fake relay configuration
 * @returns Fake relay client with testing helpers
 */
export function createFakeRelayClient(
  config?: FakeRelayClientConfig,
): RelayClient & {
  getCalls(): FakeRelayCall[];
  callCount(): number;
} {
  const name = config?.name ?? "fake-relay";
  const signature = config?.signature ?? "fake-relay-signature";
  const error = config?.error;

  const calls: FakeRelayCall[] = [];

  const relay: RelayClient & {
    getCalls(): FakeRelayCall[];
    callCount(): number;
  } = {
    name,

    async sendTransaction(base64: string): Promise<RelaySendResult> {
      calls.push({ base64 });

      if (error) {
        throw error;
      }

      return {
        signature,
        relayName: name,
      };
    },

    getCalls(): FakeRelayCall[] {
      return [...calls];
    },

    callCount(): number {
      return calls.length;
    },
  };

  return relay;
}

