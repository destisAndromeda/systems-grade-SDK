/**
 * Fake RPC transport for testing.
 *
 * Allows tests to mock RPC responses and errors.
 */

import type { RpcTransport } from "../rpc/types.js";
import type { SdkError } from "../core/error.js";
import { createSdkError } from "../core/error.js";

interface FakeTransportCall {
  method: string;
  params: unknown;
  options?: { timeoutMs?: number };
}

/**
 * Create a fake RPC transport for testing.
 *
 * @param config.endpointUrl URL for this fake endpoint
 * @param config.endpointId Unique ID for this endpoint
 * @param config.responses Map of method -> response or error
 * @returns Fake RPC transport with testing helpers
 */
export function createFakeRpcTransport(config: {
  endpointUrl: string;
  endpointId: string;
  responses?: Map<string, { success: unknown } | { error: SdkError }>;
}): RpcTransport & {
  getCalls(): FakeTransportCall[];
  callCount(method?: string): number;
} {
  const calls: FakeTransportCall[] = [];
  const responses = config.responses ?? new Map();

  const transport: RpcTransport & {
    getCalls(): FakeTransportCall[];
    callCount(method?: string): number;
  } = {
    endpointUrl: config.endpointUrl,
    endpointId: config.endpointId,

    async send<TParams, TResult>(
      method: string,
      params: TParams,
      options?: { timeoutMs?: number },
    ): Promise<TResult> {
      calls.push({ method, params, options });

      const response = responses.get(method);
      if (!response) {
        throw createSdkError("InvalidResponse", `No mock response configured for method: ${method}`);
      }

      if ("error" in response) {
        throw response.error;
      }

      return response.success as TResult;
    },

    getCalls(): FakeTransportCall[] {
      return [...calls];
    },

    callCount(method?: string): number {
      if (method === undefined) {
        return calls.length;
      }
      return calls.filter((call) => call.method === method).length;
    },
  };

  return transport;
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
