import { createSolanaRpc } from '@solana/kit';

type SolanaRpc = ReturnType<typeof createSolanaRpc>;

export class RpcClient {
    readonly rpc: SolanaRpc;
    private endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint;
        this.rpc = createSolanaRpc(endpoint);
    }

    async checkHealth() {
        const start = Date.now();
        try {
            await this.rpc.getSlot().send();
            return { endpoint: this.endpoint, isHealthy: true, latencyMs: Date.now() - start };
        } catch {
            return { endpoint: this.endpoint, isHealthy: false, latencyMs: Date.now() - start };
        }
    }
}