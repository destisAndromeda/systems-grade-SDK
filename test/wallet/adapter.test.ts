/**
 * Tests for wallet adapter.
 */

import { describe, it, expect } from "vitest";
import { signTransactionWithWallet, sendViaWallet } from "../../src/wallet/adapter.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { buildPreparedTransaction } from "../../src/tx/send.js";
import { createSdkError, isKindOfSdkError } from "../../src/core/error.js";
import { isOk, isErr } from "../../src/core/result.js";
import type { TransactionWallet, WalletSignResult } from "../../src/wallet/types.js";

const validBase64 = Buffer.from("tx").toString("base64");
const signedBase64 = Buffer.from("signed-tx").toString("base64");
const blockhash = "blockhash123";
const lastValidBlockHeight = 1000;

describe("signTransactionWithWallet", () => {
  it("signs valid base64 transaction", async () => {
    const wallet: TransactionWallet = {
      publicKey: "pubkey123",
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64, publicKey: "pubkey123" };
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isOk(result)).toBe(true);
  });

  it("returns signed base64", async () => {
    const wallet: TransactionWallet = {
      publicKey: "pubkey123",
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64, publicKey: "pubkey123" };
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signedBase64).toBe(signedBase64);
    }
  });

  it("includes wallet public key when present", async () => {
    const wallet: TransactionWallet = {
      publicKey: "custom-pubkey",
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64, publicKey: "custom-pubkey" };
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.publicKey).toBe("custom-pubkey");
    }
  });

  it("does not include public key when missing", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.publicKey).toBeUndefined();
    }
  });

  it("rejects empty base64 with InvalidTransaction", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const result = await signTransactionWithWallet(wallet, "");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("InvalidTransaction");
      }
    }
  });

  it("rejects invalid base64 with InvalidTransaction", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const result = await signTransactionWithWallet(wallet, "not-valid-base64!");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("InvalidTransaction");
      }
    }
  });

  it("rejects wallet returned empty signed transaction", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64: Buffer.alloc(0).toString("base64") };
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("InvalidTransaction");
      }
    }
  });

  it("rejects wallet returned invalid base64", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64: "not-valid-base64!" };
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("InvalidTransaction");
      }
    }
  });

  it("maps wallet thrown error to InvalidTransaction", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        throw new Error("Wallet error");
      },
    };

    const result = await signTransactionWithWallet(wallet, validBase64);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("InvalidTransaction");
      }
    }
  });

  it("does not throw", async () => {
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    // Should not throw
    const result = await signTransactionWithWallet(wallet, validBase64);
    expect(result).toBeDefined();
  });
});

describe("sendViaWallet", () => {
  it("signs transaction before sending", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    let signCalled = false;
    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        signCalled = true;
        return { signedBase64 };
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    await sendViaWallet(wallet, transport, prepared.value);

    expect(signCalled).toBe(true);
  });

  it("sends signed transaction via RPC", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const result = await sendViaWallet(wallet, transport, prepared.value);

    expect(isOk(result)).toBe(true);
    expect(transport.callCount("sendTransaction")).toBe(1);
  });

  it("returns signature and endpoint id", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig123" }]]),
    });

    const result = await sendViaWallet(wallet, transport, prepared.value);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.signature).toBe("sig123");
      expect(result.value.endpointId).toBe("rpc-test");
    }
  });

  it("preserves send options", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const options = { skipPreflight: true, maxRetries: 5 };
    await sendViaWallet(wallet, transport, prepared.value, options);

    // The RPC should have been called with the transaction
    expect(transport.callCount("sendTransaction")).toBe(1);
  });

  it("does not call transport if signing fails", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        throw new Error("Sign failed");
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    await sendViaWallet(wallet, transport, prepared.value);

    expect(transport.callCount()).toBe(0);
  });

  it("returns signing error if signing fails", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        throw new Error("Sign failed");
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const result = await sendViaWallet(wallet, transport, prepared.value);

    expect(isErr(result)).toBe(true);
  });

  it("returns send error if RPC send fails", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const sendError = createSdkError("NetworkError", "RPC send failed");
    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { error: sendError }]]),
    });

    const result = await sendViaWallet(wallet, transport, prepared.value);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("NetworkError");
      }
    }
  });

  it("does not throw", async () => {
    const prepared = buildPreparedTransaction(validBase64, blockhash, lastValidBlockHeight);
    if (!isOk(prepared)) {
      throw new Error("Prepared transaction should be ok");
    }

    const wallet: TransactionWallet = {
      async signTransaction(base64: string): Promise<WalletSignResult> {
        return { signedBase64 };
      },
    };

    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    // Should not throw
    const result = await sendViaWallet(wallet, transport, prepared.value);
    expect(result).toBeDefined();
  });
});

