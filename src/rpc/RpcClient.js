import { createSolanaRpc } from '@solana/kit';
export class RpcClient {
    rpc;
    endpoint;
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.rpc = createSolanaRpc('https://api.devnet.solana.com');
    }
    async checkHealth() {
        const start = Date.now();
        try {
            await this.rpc.getSlot().send();
            return { endpoint: this.endpoint, isHealthy: true, latencyMs: Date.now() - start };
        }
        catch {
            return { endpoint: this.endpoint, isHealthy: false, latencyms: Date.now() - start };
        }
    }
}
