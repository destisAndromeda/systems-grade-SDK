import { describe, expect, it } from "vitest";
import {
  type Blockhash,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { createSolanaReliabilitySdk } from "../../src/sdk/create-sdk.js";
import { isOk } from "../../src/core/result.js";
import { createFakeRpcTransport } from "../../src/testing/fake-transport.js";

describe("@solana/kit compatibility", () => {
  it("builds a real @solana/kit transaction and sends it as base64 through sdk.sendTransaction", async () => {
    const endpointUrl = "https://api.test";
    const endpointId = "https_api_test";
    const fakeSignature = "fake-signature-from-rpc";

    const fakeTransport = createFakeRpcTransport({
      endpointUrl,
      endpointId,
      responses: new Map([
        ["sendTransaction", { success: fakeSignature }],
      ]),
    });

    const sdkResult = createSolanaReliabilitySdk(
      {
        endpoints: [endpointUrl],
        retry: { maxAttempts: 1 },
      },
      {
        transports: new Map([[endpointId, fakeTransport]]),
      },
    );

    expect(isOk(sdkResult)).toBe(true);
    if (!isOk(sdkResult)) {
      throw sdkResult.error;
    }

    const sdk = sdkResult.value;

    const source = await generateKeyPairSigner();
    const destination = await generateKeyPairSigner();

    const latestBlockhash = {
      blockhash: "11111111111111111111111111111111" as Blockhash,
      lastValidBlockHeight: 123n,
    };

    const transferInstruction = getTransferSolInstruction({
      source,
      destination: destination.address,
      amount: lamports(1n),
    });

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(source, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstruction(transferInstruction, tx),
    );

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    const transactionBase64 = getBase64EncodedWireTransaction(signedTransaction);

    expect(typeof transactionBase64).toBe("string");
    expect(Buffer.from(transactionBase64, "base64").length).toBeGreaterThan(0);

    const sendResult = await sdk.sendTransaction(
      transactionBase64,
      latestBlockhash.blockhash,
      Number(latestBlockhash.lastValidBlockHeight),
      {
        skipPreflight: true,
        maxRetries: 0,
      },
    );

    expect(isOk(sendResult)).toBe(true);
    if (!isOk(sendResult)) {
      throw sendResult.error;
    }

    expect(sendResult.value).toBe(fakeSignature);

    expect(fakeTransport.callCount("sendTransaction")).toBe(1);

    const calls = fakeTransport.getCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("sendTransaction");

    const params = calls[0]?.params as unknown[];
    expect(params[0]).toBe(transactionBase64);
    expect(params[1]).toMatchObject({
      encoding: "base64",
      skipPreflight: true,
      maxRetries: 0,
    });
  });
});
