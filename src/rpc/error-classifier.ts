/**
 * Error classifier for RPC operations.
 *
 * Categorizes errors into high-level types (Network, Timeout, RateLimited, etc.)
 * and determines whether an error indicates an endpoint fault that warrants
 * retry/failover/circuit-breaker logic.
 */

/**
 * High-level error categories.
 * Each represents a distinct type of failure mode.
 */
export enum ErrorClass {
  /** Network-level error (connection refused, socket error, etc.) */
  Network = "Network",
  /** Request timed out */
  Timeout = "Timeout",
  /** Rate limit exceeded (HTTP 429 or equivalent) */
  RateLimited = "RateLimited",
  /** Server error (HTTP 5xx or equivalent) */
  ServerError = "ServerError",
  /** JSON-RPC error (application-level failure, not endpoint fault) */
  RpcError = "RpcError",
  /** Uncategorized error */
  Unknown = "Unknown",
}

/**
 * Classify an error into one of the predefined categories.
 *
 * Classification rules (checked in order):
 * - If SdkError with kind "InvalidResponse" (non-retryable JSON-RPC error): RpcError
 * - Timeout: AbortError, or message contains "timeout"/"timed out", or SdkError kind "Timeout"
 * - RateLimited: Code 429, HTTP 429 in message, or SdkError kind "RateLimited"
 * - ServerError: HTTP 5xx in message, status 500-599, or SdkError kind "NetworkError" with 5xx message
 * - Network: Connection error names, "fetch failed", or SdkError kind "NetworkError"
 * - RpcError: Object with code and message fields where code is negative number or non-numeric string
 * - Unknown: Everything else
 *
 * @param error The error to classify (can be any type)
 * @returns The error class
 */
export function classifyError(error: unknown): ErrorClass {
  // Extract error properties, handling both Error instances and plain objects
  let errorName = "";
  let errorMessage: string;
  let errorKind = "";
  const errorCode = (error as any)?.code ?? (error as any)?.errno;

  if (error instanceof Error) {
    errorName = error.name;
    errorMessage = error.message;
    // Check if it's an SdkError with a kind field
    errorKind = (error as any).kind ?? "";
  } else if (typeof error === "object" && error !== null) {
    // Plain object - try to extract message field
    errorMessage = (error as any).message ?? String(error);
    errorKind = (error as any).kind ?? "";
  } else {
    errorMessage = String(error);
  }

  const errorString = errorMessage.toLowerCase();

  // If it's an SdkError, classify based on its kind
  if (errorKind) {
    if (errorKind === "InvalidResponse") {
      return ErrorClass.RpcError;
    }
    if (errorKind === "Timeout") {
      return ErrorClass.Timeout;
    }
    if (errorKind === "RateLimited") {
      return ErrorClass.RateLimited;
    }
    if (errorKind === "NetworkError") {
      // NetworkError could be timeout, rate limit, or network
      // Check message for specifics
      if (errorString.includes("timeout")) {
        return ErrorClass.Timeout;
      }
      if (errorString.includes("429")) {
        return ErrorClass.RateLimited;
      }
      if (errorString.includes("http 5") || /http [5]\d{2}/.test(errorString)) {
        return ErrorClass.ServerError;
      }
      return ErrorClass.Network;
    }
  }

  // Check for AbortError (timeout)
  if (errorName === "AbortError") {
    return ErrorClass.Timeout;
  }

  // Check for timeout in message
  if (errorString.includes("timeout") || errorString.includes("timed out")) {
    return ErrorClass.Timeout;
  }

  // Check for rate limit
  if (errorCode === 429) {
    return ErrorClass.RateLimited;
  }
  if (errorString.includes("http 429") || errorString.includes("429")) {
    return ErrorClass.RateLimited;
  }
  if (errorString.includes("rate limit") || errorString.includes("too many requests")) {
    return ErrorClass.RateLimited;
  }

  // Check for server error
  if (errorString.includes("http 5") || /http [5]\d{2}/.test(errorString)) {
    return ErrorClass.ServerError;
  }
  if ((errorCode as number) >= 500 && (errorCode as number) < 600) {
    return ErrorClass.ServerError;
  }
  if (errorString.includes("internal server error") || errorString.includes("service unavailable")) {
    return ErrorClass.ServerError;
  }

  // Check for network-level errors
  const networkErrorCodes = ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ECONNABORTED", "EAGAIN", "EHOSTUNREACH"];
  if (networkErrorCodes.includes(errorCode)) {
    return ErrorClass.Network;
  }
  if (networkErrorCodes.includes(errorName)) {
    return ErrorClass.Network;
  }
  if (
    errorString.includes("fetch failed") ||
    errorString.includes("network error") ||
    errorString.includes("socket") ||
    errorString.includes("eai_again")
  ) {
    return ErrorClass.Network;
  }

  // Check for JSON-RPC error: object with code and message fields
  // Code should be either negative (JSON-RPC range) or a string (custom code)
  if (typeof error === "object" && error !== null) {
    const obj = error as any;
    if (typeof obj.message === "string" && obj.code !== undefined) {
      // Accept if code is negative number (JSON-RPC spec range)
      if (typeof obj.code === "number" && obj.code < 0) {
        return ErrorClass.RpcError;
      }
      // Accept if code is non-numeric string
      if (typeof obj.code === "string") {
        return ErrorClass.RpcError;
      }
    }
  }

  // Everything else
  return ErrorClass.Unknown;
}

/**
 * Determine if an error class represents an endpoint fault.
 *
 * Endpoint faults are errors that warrant retry/failover/circuit-breaker logic.
 * RPC errors (application-level failures) are NOT endpoint faults.
 *
 * @param errorClass The error class to check
 * @returns True if this is an endpoint fault, false if it's an application error
 */
export function isEndpointFault(errorClass: ErrorClass): boolean {
  return errorClass !== ErrorClass.RpcError;
}
