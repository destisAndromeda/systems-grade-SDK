/**
 * Result<T, E> type and utilities.
 *
 * The Result pattern replaces thrown exceptions with explicit ok/error values.
 * Core domain functions return Result to represent expected failures.
 * Only the outer boundary (RpcTransport adapters, SDK methods) converts Result to Promise rejections.
 */

/**
 * Result is a discriminated union representing success or failure.
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Construct a successful Result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Construct a failed Result.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard: is this Result a success?
 */
export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok === true;
}

/**
 * Type guard: is this Result a failure?
 */
export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return r.ok === false;
}

/**
 * Map a successful Result's value; pass through errors unchanged.
 */
export function mapResult<T, U, E>(
  r: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return isOk(r) ? ok(fn(r.value)) : r;
}

/**
 * Unwrap a Result or throw the error.
 * Used at SDK boundary to convert Result to Promise rejection.
 */
export function unwrapResult<T, E extends Error>(r: Result<T, E>): T {
  if (isOk(r)) {
    return r.value;
  }
  throw r.error;
}
