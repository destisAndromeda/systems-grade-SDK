/**
 * Endpoint registry implementation.
 *
 * Simple in-memory registry that stores and tracks RPC endpoint state.
 * Updated as requests succeed or fail.
 */

import type { RpcEndpointConfig, RpcEndpointState, EndpointRegistry } from "./types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { normalizeRpcEndpointConfig, createInitialEndpointState } from "./endpoint.js";

/**
 * Create an in-memory registry of RPC endpoints.
 *
 * @param configs Array of endpoint configs (strings or objects)
 * @returns Registry if successful, error if config is invalid
 */
export function createEndpointRegistry(
  configs: (string | RpcEndpointConfig)[],
): Result<EndpointRegistry> {
  // TODO: normalize all configs, deduplicate by URL, initialize state for each,
  // return registry implementation or err(InvalidConfig)
  throw new Error("TODO");
}

/**
 * Simple in-memory registry implementation.
 */
class InMemoryEndpointRegistry implements EndpointRegistry {
  private states: Map<string, RpcEndpointState> = new Map();

  constructor(states: RpcEndpointState[]) {
    for (const state of states) {
      this.states.set(state.id, state);
    }
  }

  getAll(): RpcEndpointState[] {
    return Array.from(this.states.values());
  }

  getById(id: string): RpcEndpointState | undefined {
    return this.states.get(id);
  }

  upsert(state: RpcEndpointState): void {
    this.states.set(state.id, state);
  }
}
