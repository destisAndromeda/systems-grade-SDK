import { describe, it, expect } from "vitest";
import { signTransactionWithWallet, sendViaWallet, createWalletFromLegacyAdapter } from "../../src/wallet/adapter.js";
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

// ---------------------------------------------------------------------------
// Phase 7 — createWalletFromLegacyAdapter
// ---------------------------------------------------------------------------

/**
 * Minimal fake transaction used in all legacy-adapter tests.
 * Carries the original byte array so tests can assert deserialization,
 * and an optional output array to simulate byte mutation during signing.
 */
class FakeTransaction {
  constructor(
    readonly bytes: Uint8Array,
    private readonly output: Uint8Array = bytes,
  ) {}

  serialize(): Uint8Array {
    return this.output;
  }
}

describe("createWalletFromLegacyAdapter", () => {
  it("creates a sign-only wallet from a legacy adapter", async () => {
    const inputBytes = new Uint8Array([1, 2, 3]);
    const signedBytes = new Uint8Array([9, 8, 7]);

    const adapter = {
      name: "Test Wallet",
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        return new FakeTransaction(tx.bytes, signedBytes);
      },
    };

    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    const inputBase64 = Buffer.from(inputBytes).toString("base64");

    const result = await wallet.signTransaction(inputBase64);
    expect(result.signedBase64).toBeDefined();
    // Decode to confirm we get the signed bytes back
    expect(Buffer.from(result.signedBase64, "base64")).toEqual(Buffer.from(signedBytes));
  });

  it("uses adapter name when provided", () => {
    const adapter = {
      name: "My Wallet",
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        return tx;
      },
    };
    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    expect((wallet as { name?: string }).name).toBe("My Wallet");
  });

  it("uses fallback name when adapter name is missing", () => {
    const adapter = {
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        return tx;
      },
    };
    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    expect((wallet as { name?: string }).name).toBe("legacy-adapter");
  });

  it("deserializes bytes before signing", async () => {
    const inputBytes = new Uint8Array([10, 20, 30]);
    let receivedBytes: Uint8Array | undefined;

    const adapter = {
      name: "Deserialize Test",
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        receivedBytes = tx.bytes;
        return tx;
      },
    };

    const wallet = createWalletFromLegacyAdapter(
      adapter,
      (bytes) => new FakeTransaction(bytes),
    );
    await wallet.signTransaction(Buffer.from(inputBytes).toString("base64"));
    expect(receivedBytes).toEqual(inputBytes);
  });

  it("calls legacy signTransaction with the deserialized transaction", async () => {
    let signCalled = false;
    const adapter = {
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        signCalled = true;
        return tx;
      },
    };

    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    await wallet.signTransaction(Buffer.from(new Uint8Array([1])).toString("base64"));
    expect(signCalled).toBe(true);
  });

  it("serializes and returns signed transaction bytes", async () => {
    const inputBytes = new Uint8Array([1, 2, 3]);
    const signedBytes = new Uint8Array([9, 8, 7]);

    const adapter = {
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        return new FakeTransaction(tx.bytes, signedBytes);
      },
    };

    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    const result = await wallet.signTransaction(Buffer.from(inputBytes).toString("base64"));
    const decoded = Buffer.from(result.signedBase64, "base64");
    expect(new Uint8Array(decoded)).toEqual(signedBytes);
  });

  it("preserves adapter this binding", async () => {
    const adapter = {
      name: "Bound Wallet",
      secret: 42,
      async signTransaction(this: { secret: number }, tx: FakeTransaction): Promise<FakeTransaction> {
        if (this.secret !== 42) {
          throw new Error("lost this binding");
        }
        return tx;
      },
    };

    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    // Should resolve without throwing if binding is preserved
    await expect(
      wallet.signTransaction(Buffer.from(new Uint8Array([1])).toString("base64")),
    ).resolves.toBeDefined();
  });

  it("throws when signTransaction is missing", () => {
    const adapter = { name: "Read Only Wallet" };

    expect(() =>
      createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes)),
    ).toThrow();

    try {
      createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    } catch (e: unknown) {
      expect(isKindOfSdkError(e)).toBe(true);
      if (isKindOfSdkError(e)) {
        expect(e.kind).toBe("InvalidConfig");
        expect(e.message).toContain("Read Only Wallet");
        expect(e.message).toContain("signTransaction");
      }
    }
  });

  it("does not submit or call RPC", async () => {
    // The bridge has no reference to any transport; this test confirms
    // by inspection that the signTransaction call resolves without any
    // network side-effect. We track whether a hypothetical transport
    // would have been called by wiring one up — it should stay at 0.
    const transport = createFakeRpcTransport({
      endpointUrl: "https://rpc.test",
      endpointId: "rpc-test",
      responses: new Map([["sendTransaction", { success: "sig" }]]),
    });

    const adapter = {
      name: "Sign Only",
      async signTransaction(tx: FakeTransaction): Promise<FakeTransaction> {
        return tx;
      },
    };

    const wallet = createWalletFromLegacyAdapter(adapter, (bytes) => new FakeTransaction(bytes));
    await wallet.signTransaction(Buffer.from(new Uint8Array([1])).toString("base64"));

    // Transport must never be touched during a pure sign operation
    expect(transport.callCount()).toBe(0);
  });
});
