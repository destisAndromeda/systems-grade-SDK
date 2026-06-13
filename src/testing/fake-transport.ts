/**
 * Fake RPC transport for testing.
 *
 * Allows tests to mock RPC responses and errors.
 */

import type { RpcTransport } from "../rpc/types.js";
import type { SdkError } from "../core/error.js";

/**
 * Create a fake RPC transport for testing.
 *
 * @param config.endpointUrl URL for this fake endpoint
 * @param config.endpointId Unique ID for this endpoint
 * @param config.responses Map of method -> response or error
 * @returns Fake RPC transport
 */
export function createFakeRpcTransport(config: {
  endpointUrl: string;
  endpointId: string;
  responses?: Map<string, { success: unknown } | { error: SdkError }>;
}): RpcTransport {
  // TODO: create transport that returns configured responses
  throw new Error("TODO");
}

/**
 * Fake transport builder for easier test setup.
 */
export class FakeRpcTransportBuilder {
  private endpointUrl: string;
  private endpointId: string;
  private responses: Map<string, { success: unknown } | { error: SdkError }> = new Map();

  constructor(endpointUrl: string, endpointId: string) {
    this.endpointUrl = endpointUrl;
    this.endpointId = endpointId;
  }

  /**
   * Configure a successful response for a method.
   */
  withResponse(method: string, response: unknown): this {
    this.responses.set(method, { success: response });
    return this;
  }

  /**
   * Configure an error response for a method.
   */
  withError(method: string, error: SdkError): this {
    this.responses.set(method, { error });
    return this;
  }

  /**
   * Build the fake transport.
   */
  build(): RpcTransport {
    return createFakeRpcTransport({
      endpointUrl: this.endpointUrl,
      endpointId: this.endpointId,
      responses: this.responses,
    });
  }
}
