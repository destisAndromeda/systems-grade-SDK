/**
 * Real HTTP RPC transport using fetch().
 *
 * Sends JSON-RPC 2.0 requests over HTTP with proper error handling,
 * timeout support via AbortController, and retryability classification.
 */

import type { RpcTransport } from "./types.js";
import { createSdkError, isKindOfSdkError } from "../core/error.js";
import { mapTransportErrorToSdkError } from "./transport.js";

export interface HttpRpcTransportConfig {
  endpointUrl: string;
  endpointId: string;
  headers?: Record<string, string>;
}

let requestIdCounter = 0;

export function createHttpRpcTransport(config: HttpRpcTransportConfig): RpcTransport {
  return {
    endpointUrl: config.endpointUrl,
    endpointId: config.endpointId,

    async send<TParams, TResult>(
      method: string,
      params: TParams,
      options?: { timeoutMs?: number },
    ): Promise<TResult> {
      const requestId = ++requestIdCounter;
      const body = JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(config.headers ?? {}),
      };

      let controller: AbortController | undefined;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      try {
        if (options?.timeoutMs !== undefined) {
          controller = new AbortController();
          timeoutHandle = setTimeout(() => controller!.abort(), options.timeoutMs);
        }

        const response = await fetch(config.endpointUrl, {
          method: "POST",
          headers,
          body,
          signal: controller?.signal,
        });

        if (response.status === 429) {
          throw createSdkError("RateLimited", `HTTP 429: ${response.statusText}`, {
            retryable: true,
          });
        }

        if (response.status === 401 || response.status === 403) {
          throw createSdkError("Unknown", `HTTP ${response.status}: ${response.statusText}`, {
            retryable: false,
          });
        }

        if (response.status >= 500) {
          throw createSdkError("NetworkError", `HTTP ${response.status}: ${response.statusText}`, {
            retryable: true,
          });
        }

        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw createSdkError("InvalidResponse", "Invalid JSON in response body", {
            retryable: false,
          });
        }

        const jsonRpcResponse = data as Record<string, unknown> | undefined;
        if (typeof jsonRpcResponse !== "object" || jsonRpcResponse === null) {
          throw createSdkError("InvalidResponse", "Response is not a JSON object", {
            retryable: false,
          });
        }

        if ("error" in jsonRpcResponse && jsonRpcResponse.error !== null) {
          const error = jsonRpcResponse.error as Record<string, unknown> | undefined;
          const code = (error?.code ?? 0) as number;
          const retryableCodes = [-32004, -32005, -32009, -32017];
          const isRetryable = retryableCodes.includes(code);
          const errorMessage = (error?.message ?? "Unknown error") as string;

          throw createSdkError(
            isRetryable ? "NetworkError" : "InvalidResponse",
            `JSON-RPC error ${code}: ${errorMessage}`,
            { retryable: isRetryable },
          );
        }

        if (!("result" in jsonRpcResponse)) {
          throw createSdkError("InvalidResponse", "No result or error in JSON-RPC response", {
            retryable: false,
          });
        }

        return jsonRpcResponse.result as TResult;
      } catch (error: unknown) {
        if (isKindOfSdkError(error)) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw createSdkError("Timeout", "Request timeout", { retryable: true });
        }
        throw mapTransportErrorToSdkError(error);
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      }
    },
  };
}
