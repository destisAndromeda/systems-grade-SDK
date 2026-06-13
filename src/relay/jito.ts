/**
 * Jito relay client adapter.
 *
 * Creates a RelayClient that sends transactions to Jito.
 * Jito endpoint is specified via RPC URL.
 */

import type { RelayClient } from "./types.js";
import type { RpcTransport } from "../rpc/types.js";
import type { PreparedTransaction } from "../tx/types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";

/**
 * Create a Jito relay client.
 *
 * @param config.jitoUrl Jito endpoint URL
 * @param config.transport Optional custom transport (otherwise will create one)
 * @returns Jito relay client
 */
export function createJitoRelayClient(config: {
  jitoUrl: string;
  transport?: RpcTransport;
}): RelayClient {
  // TODO: create a RelayClient that sends bundles/transactions to Jito endpoint
  throw new Error("TODO");
}
