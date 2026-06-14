import { describe, expect, it, vi } from "vitest";
import {
  createWalletStandardTransactionWallet,
  SOLANA_SIGN_TRANSACTION,
} from "../../src/wallet/standard-wallet.js";
import { signTransactionWithWallet, sendViaWallet } from "../../src/wallet/adapter.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";
import { buildPreparedTransaction } from "../../src/tx/send.js";
import { isOk } from "../../src/core/result.js";
import { isKindOfSdkError } from "../../src/core/error.js";

describe("Wallet Standard Adapter", () => {
  const mockSolanaAccount = {
    address: "Phantom111111111111111111111111111111111",
    publicKey: new Uint8Array(32),
    chains: ["solana:mainnet"],
    features: [SOLANA_SIGN_TRANSACTION],
  };

  const unsignedBase64 = Buffer.from("unsigned-wallet-standard-tx").toString("base64");
  const signedBase64 = Buffer.from("signed-wallet-standard-tx").toString("base64");

  it("adapts a Phantom-compatible Wallet Standard wallet to TransactionWallet", async () => {
    const signTransactionSpy = vi.fn().mockImplementation(async (input) => {
      return [
        {
          signedTransaction: Buffer.from("signed-wallet-standard-tx"),
        },
      ];
    });

    const mockWallet = {
      version: "1.0.0",
      name: "Phantom",
      chains: ["solana:mainnet"],
      features: {
        [SOLANA_SIGN_TRANSACTION]: {
          version: "1.0.0",
          signTransaction: signTransactionSpy,
        },
      },
      accounts: [mockSolanaAccount],
    };

    const adapter = createWalletStandardTransactionWallet(mockWallet);
    expect(adapter.publicKey).toBe(mockSolanaAccount.address);

    const result = await signTransactionWithWallet(adapter, unsignedBase64);
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.signedBase64).toBe(signedBase64);
      expect(result.value.publicKey).toBe(mockSolanaAccount.address);
    }

    expect(signTransactionSpy).toHaveBeenCalledTimes(1);
    const calledArgs = signTransactionSpy.mock.calls[0];
    expect(calledArgs).toBeDefined();
    if (calledArgs && calledArgs[0]) {
      expect(calledArgs[0].account).toBe(mockSolanaAccount);
      expect(Buffer.from(calledArgs[0].transaction).toString("base64")).toBe(unsignedBase64);
      expect(calledArgs[0].chain).toBe("solana:mainnet");
    }
  });

  it("uses Wallet Standard signing before resilient RPC send", async () => {
    const signTransactionSpy = vi.fn().mockImplementation(async () => {
      return [
        {
          signedTransaction: Buffer.from("signed-wallet-standard-tx"),
        },
      ];
    });

    const mockWallet = {
      version: "1.0.0",
      name: "Phantom",
      chains: ["solana:mainnet"],
      features: {
        [SOLANA_SIGN_TRANSACTION]: {
          version: "1.0.0",
          signTransaction: signTransactionSpy,
        },
      },
      accounts: [mockSolanaAccount],
    };

    const adapter = createWalletStandardTransactionWallet(mockWallet);

    const blockhash = "11111111111111111111111111111111";
    const lastValidBlockHeight = 100;
    const preparedResult = buildPreparedTransaction(unsignedBase64, blockhash, lastValidBlockHeight);
    expect(isOk(preparedResult)).toBe(true);

    if (!isOk(preparedResult)) {
      throw new Error("Failed to build prepared transaction");
    }

    const fakeTransport = createFakeRpcTransport({
      endpointUrl: "https://api.test",
      endpointId: "https_api_test",
      responses: new Map([
        ["sendTransaction", { success: "wallet-standard-signature" }],
      ]),
    });

    const sendResult = await sendViaWallet(adapter, fakeTransport, preparedResult.value, {
      skipPreflight: true,
      maxRetries: 0,
    });

    expect(isOk(sendResult)).toBe(true);
    if (isOk(sendResult)) {
      expect(sendResult.value.signature).toBe("wallet-standard-signature");
      expect(sendResult.value.endpointId).toBe("https_api_test");
    }

    expect(signTransactionSpy).toHaveBeenCalledTimes(1);
    expect(fakeTransport.callCount("sendTransaction")).toBe(1);

    const calls = fakeTransport.getCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("sendTransaction");

    const params = calls[0]?.params as unknown[];
    expect(params[0]).toBe(signedBase64);
    expect(params[1]).toMatchObject({
      encoding: "base64",
      skipPreflight: true,
      maxRetries: 0,
    });
  });

  it("returns an error when Wallet Standard signTransaction feature is missing", async () => {
    const mockWallet = {
      version: "1.0.0",
      name: "Phantom",
      chains: ["solana:mainnet"],
      features: {}, // missing solana:signTransaction feature
      accounts: [mockSolanaAccount],
    };

    const adapter = createWalletStandardTransactionWallet(mockWallet);
    const result = await signTransactionWithWallet(adapter, unsignedBase64);
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(isKindOfSdkError(result.error)).toBe(true);
      if (isKindOfSdkError(result.error)) {
        expect(result.error.kind).toBe("InvalidTransaction");
        expect(result.error.message).toContain("solana:signTransaction");
      }
    }
  });

  it("does not choose non-Solana accounts", () => {
    const mockEthAccount = {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      publicKey: new Uint8Array(20),
      chains: ["ethereum:mainnet"],
      features: [],
    };

    const mockWallet = {
      version: "1.0.0",
      name: "Phantom",
      chains: ["ethereum:mainnet", "solana:mainnet"],
      features: {
        [SOLANA_SIGN_TRANSACTION]: {
          version: "1.0.0",
          signTransaction: async () => [],
        },
      },
      accounts: [mockEthAccount, mockSolanaAccount],
    };

    // Case A: Selects the Solana account even if Ethereum account is first
    const adapter = createWalletStandardTransactionWallet(mockWallet);
    expect(adapter.publicKey).toBe(mockSolanaAccount.address);

    // Case B: Throws InvalidConfig if only non-Solana accounts exist
    const mockOnlyEthWallet = {
      ...mockWallet,
      accounts: [mockEthAccount],
    };

    expect(() => createWalletStandardTransactionWallet(mockOnlyEthWallet)).toThrow();
  });

  it("exports Wallet Standard adapter from public index", async () => {
    const index = await import("../../src/index.js");
    expect(typeof index.createWalletStandardTransactionWallet).toBe("function");
    expect(index.SOLANA_SIGN_TRANSACTION).toBe("solana:signTransaction");
  });
});
