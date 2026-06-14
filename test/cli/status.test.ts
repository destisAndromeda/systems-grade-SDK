/**
 * Tests for CLI status command.
 */

import { describe, it, expect } from "vitest";
import {
  formatTransactionStatus,
  createTransactionStatusReport,
} from "../../src/cli/status.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { ok, err } from "../../src/core/result.js";
import { createSdkError } from "../../src/core/error.js";

// ---------------------------------------------------------------------------
// formatTransactionStatus
// ---------------------------------------------------------------------------

describe("formatTransactionStatus", () => {
  it("renders pending status", () => {
    const result = formatTransactionStatus("sig123", ok({ kind: "pending" }));
    expect(result).toBe("Transaction sig123: pending");
  });

  it("renders confirmed status with slot", () => {
    const result = formatTransactionStatus(
      "sig123",
      ok({ kind: "confirmed", slot: 42 }),
    );
    expect(result).toBe("Transaction sig123: confirmed at slot 42");
  });

  it("renders confirmed status without slot", () => {
    const result = formatTransactionStatus("sig123", ok({ kind: "confirmed" }));
    expect(result).toBe("Transaction sig123: confirmed");
  });

  it("renders finalized status with slot", () => {
    const result = formatTransactionStatus(
      "sig123",
      ok({ kind: "finalized", slot: 99 }),
    );
    expect(result).toBe("Transaction sig123: finalized at slot 99");
  });

  it("renders finalized status without slot", () => {
    const result = formatTransactionStatus("sig123", ok({ kind: "finalized" }));
    expect(result).toBe("Transaction sig123: finalized");
  });

  it("renders failed status", () => {
    const result = formatTransactionStatus(
      "sig123",
      ok({ kind: "failed", error: "InstructionError" }),
    );
    expect(result).toBe("Transaction sig123: failed: InstructionError");
  });

  it("renders error result", () => {
    const sdkError = createSdkError("NetworkError", "connection refused");
    const result = formatTransactionStatus("sig123", err(sdkError));
    expect(result).toContain("Error fetching transaction status for sig123");
    expect(result).toContain("connection refused");
  });
});

// ---------------------------------------------------------------------------
// createTransactionStatusReport
// ---------------------------------------------------------------------------

describe("createTransactionStatusReport", () => {
  it("calls getSignatureStatuses and returns confirmed status", async () => {
    const signature = "5test1SignatureBase58Placeholder";

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "https_api_test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "confirmed",
                  slot: 123,
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await createTransactionStatusReport(
      signature,
      { endpointUrl: "https://api.test" },
      { transport: fakeTransport },
    );

    expect(result).toContain("confirmed");
    expect(result).toContain("123");

    // Verify exactly one call was made to getSignatureStatuses
    expect(fakeTransport.callCount("getSignatureStatuses")).toBe(1);

    // Verify params include the signature and searchTransactionHistory
    const calls = fakeTransport.getCalls();
    const call = calls[0];
    expect(call).toBeDefined();
    if (!call) return; // type guard
    expect(call.method).toBe("getSignatureStatuses");
    const params = call.params as unknown[];
    expect((params[0] as string[])).toContain(signature);
    expect(((params[1] as unknown) as Record<string, unknown>).searchTransactionHistory).toBe(true);
  });

  it("calls getSignatureStatuses and returns finalized status", async () => {
    const signature = "5test1SignatureBase58Placeholder";

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "https_api_test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [
                {
                  confirmationStatus: "finalized",
                  slot: 999,
                  err: null,
                },
              ],
            },
          },
        ],
      ]),
    });

    const result = await createTransactionStatusReport(
      signature,
      { endpointUrl: "https://api.test" },
      { transport: fakeTransport },
    );

    expect(result).toContain("finalized");
    expect(result).toContain("999");
  });

  it("calls getSignatureStatuses and returns pending when null", async () => {
    const signature = "5test1SignatureBase58Placeholder";

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "https_api_test",
      responses: new Map([
        [
          "getSignatureStatuses",
          {
            success: {
              value: [null],
            },
          },
        ],
      ]),
    });

    const result = await createTransactionStatusReport(
      signature,
      { endpointUrl: "https://api.test" },
      { transport: fakeTransport },
    );

    expect(result).toContain("pending");
  });

  it("validates missing signature and returns usage text", async () => {
    const result = await createTransactionStatusReport(
      "",
      { endpointUrl: "https://api.test" },
    );
    expect(result).toContain("Usage");
    expect(result).toContain("Missing");
    expect(result).toContain("signature");
  });

  it("validates whitespace-only signature", async () => {
    const result = await createTransactionStatusReport(
      "   ",
      { endpointUrl: "https://api.test" },
    );
    // fetchTransactionStatus returns an err for whitespace-only; formatTransactionStatus renders it
    expect(result.toLowerCase()).toMatch(/usage|error|whitespace/);
  });

  it("validates missing endpoint URL when no injected transport", async () => {
    const result = await createTransactionStatusReport(
      "5test1SignatureBase58Placeholder",
      { endpointUrl: "" },
    );
    expect(result).toContain("Usage");
    expect(result).toContain("--endpoint");
  });

  it("handles transport error and formats it", async () => {
    const fakeError = createSdkError("NetworkError", "timeout");
    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "https_api_test",
      responses: new Map([
        ["getSignatureStatuses", { error: fakeError }],
      ]),
    });

    const result = await createTransactionStatusReport(
      "5test1SignatureBase58Placeholder",
      { endpointUrl: "https://api.test" },
      { transport: fakeTransport },
    );

    expect(result).toContain("Error fetching transaction status");
    expect(result).toContain("timeout");
  });
});
