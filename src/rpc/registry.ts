/**
 * Endpoint registry implementation.
 *
 * Simple in-memory registry that stores and tracks RPC endpoint state.
 * Updated as requests succeed or fail.
 */

import type { RpcEndpointConfig, RpcEndpointState, EndpointRegistry } from "./types.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { createSdkError } from "../core/error.js";
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
  if (!configs || configs.length === 0) {
    return err(createSdkError("InvalidConfig", "At least one endpoint must be provided"));
  }

  // Normalize all configs
  const normalized: RpcEndpointConfig[] = [];
  const seenIds = new Set<string>();

  for (const config of configs) {
    const result = normalizeRpcEndpointConfig(config);
    if (!result.ok) {
      return result as Result<EndpointRegistry>;
    }

    const normalized_config = result.value;
    const id = createInitialEndpointState(normalized_config).id;

    // Deduplicate by ID
    if (!seenIds.has(id)) {
      seenIds.add(id);
      normalized.push(normalized_config);
    }
  }

  // Initialize state for each endpoint
  const states = normalized.map((config) => createInitialEndpointState(config));

  return ok(new InMemoryEndpointRegistry(states));
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
