/**
 * AbortSignal utilities for combining timeout and caller signal.
 *
 * Provides safe composition of timeouts and caller-provided AbortSignals
 * with guaranteed cleanup (no timer or listener leaks).
 */

/**
 * Result of combining a timeout with a caller's AbortSignal.
 * Includes the combined signal and a cleanup function to prevent leaks.
 */
export interface CombinedAbortSignal {
  signal: AbortSignal;
  cleanup: () => void;
}

/**
 * Combine a timeout and an optional caller AbortSignal.
 *
 * Creates an internal AbortController that will abort after timeoutMs.
 * If callerSignal is provided, propagates its abort reason to the combined signal.
 * If callerSignal is already aborted, the combined signal is aborted immediately.
 *
 * @param timeoutMs Timeout in milliseconds (must be non-negative)
 * @param callerSignal Optional caller-provided AbortSignal to combine
 * @returns Combined signal and cleanup function
 * @throws RangeError if timeoutMs is negative
 */
export function combineWithTimeout(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): CombinedAbortSignal {
  if (timeoutMs < 0) {
    throw new RangeError(`timeoutMs must be non-negative, got ${timeoutMs}`);
  }

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let listenerAttached = false;
  let cleaned = false;

  /**
   * Internal handler for when caller signal aborts.
   * Propagates the abort reason to the combined signal.
   */
  const onCallerAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort(callerSignal!.reason);
    }
  };

  // Set timeout for internal abort
  timeoutHandle = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, timeoutMs);

  // Use unref() if available to not keep the process alive
  if (typeof timeoutHandle.unref === "function") {
    timeoutHandle.unref();
  }

  // Handle already-aborted caller signal
  if (callerSignal) {
    if (callerSignal.aborted) {
      // Caller signal is already aborted, abort combined signal immediately with same reason
      controller.abort(callerSignal.reason);
    } else {
      // Attach listener for future abort
      callerSignal.addEventListener("abort", onCallerAbort);
      listenerAttached = true;
    }
  }

  /**
   * Clean up the timeout timer and event listener.
   * Safe to call multiple times.
   */
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;

    // Clear the timeout
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }

    // Remove event listener from caller signal
    if (listenerAttached && callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
      listenerAttached = false;
    }
  };

  return {
    signal: controller.signal,
    cleanup,
  };
}
