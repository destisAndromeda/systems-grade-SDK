import { createClient, generateKeyPairSigner, lamports } from '@solana/kit';
import { solanaDevnetRpc } from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';
import { tokenProgram } from '@solana-program/token';
 
const client = await createClient()
    .use(signerFromFile('/home/yutiuser/.config/solana/id.json'))
    .use(solanaDevnetRpc())
    .use(tokenProgram());
 
const mint = await generateKeyPairSigner();
const createMintPlan = client.token.instructions.createMint({
    newMint: mint,
    decimals: 9,
    mintAuthority: client.identity.address,
});
 
const createMintResult = await client.sendTransaction([createMintPlan]);
const createMintSignature = createMintResult.context.signature;
 
console.log(`🎉 Created token mint ${mint.address}`);
console.log(`🔎 https://explorer.solana.com/tx/${createMintSignature}?cluster=devnet`);
 
const mintAccount = await client.token.accounts.mint.fetch(mint.address);

console.log('✅ Mint account decoded');
console.log(`   Address: ${mint.address}`);
console.log(`   Decimals: ${mintAccount.data.decimals}`);
console.log('   Mint authority:', mintAccount.data.mintAuthority);
console.log(`   Supply: ${mintAccount.data.supply}`);