/**
 * SdkError and error utilities.
 *
 * All SDK errors are represented as SdkError with a kind, message, and optional cause.
 * Retryable errors (network, timeouts) can be safely retried.
 * Non-retryable errors (invalid config, authentication) should not be retried.
 */

/**
 * Categories of errors that can occur in the SDK.
 */
export type SdkErrorKind =
  | "Timeout" // RPC call timed out
  | "NetworkError" // Network or connection failure
  | "RateLimited" // Rate limit hit (HTTP 429 or similar)
  | "InvalidConfig" // Configuration or validation error
  | "InvalidResponse" // Unexpected RPC response format
  | "InvalidTransaction" // Transaction build or signing error
  | "AllEndpointsFailed" // All RPC endpoints exhausted
  | "Unknown"; // Uncategorized error

/**
 * Standard error object used throughout the SDK.
 */
export interface SdkError extends Error {
  kind: SdkErrorKind;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

/**
 * Construct a new SdkError.
 *
 * @param kind Error category
 * @param message Human-readable message
 * @param opts.retryable Whether this error can be safely retried (defaults to kind-based value)
 * @param opts.cause Underlying error or value that caused this error
 */
export function createSdkError(
  kind: SdkErrorKind,
  message: string,
  opts?: { retryable?: boolean; cause?: unknown },
): SdkError {
  // TODO: determine retryable flag if not provided
  const retryable =
    opts?.retryable ??
    (kind === "Timeout" || kind === "NetworkError" || kind === "RateLimited");

  const error = new Error(message) as SdkError;
  error.name = `SdkError[${kind}]`;
  error.kind = kind;
  error.message = message;
  error.retryable = retryable;
  error.cause = opts?.cause;

  return error;
}

/**
 * Check if an error is retryable (should trigger retry logic).
 */
export function isRetryableSdkError(error: SdkError): boolean {
  return error.retryable ?? false;
}

/**
 * Map an unknown error to an SdkError.
 * Useful when catching exceptions and normalizing them.
 */
export function mapToSdkError(e: unknown, defaultKind: SdkErrorKind = "Unknown"): SdkError {
  if (e instanceof Error && (e as any).kind) {
    return e as SdkError;
  }
  const message = e instanceof Error ? e.message : String(e);
  return createSdkError(defaultKind, message, { cause: e });
}
