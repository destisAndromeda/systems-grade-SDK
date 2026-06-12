import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSolanaRpc } from '@solana/kit';
import { RpcClient } from '../src/rpc/RpcClient';

vi.mock('@solana/kit', () => ({
    createSolanaRpc: vi.fn(),
}));

describe('RpcClient', () => {
    const endpoint = 'https://api.devnet.solana.com';

    const mockRpc = {
        getSlot: vi.fn().mockReturnValue({ senf: vi.fn().mockResolvedValue(123n) }),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createSolanaRpc).mockReturnValue(mockRpc as any);
    });

    it('create rpc with correct endpoint', () => {
        new RpcClient(endpoint);
        expect(createSolanaRpc).toHaveBeenCalledWith(endpoint);
    });

    it('checkHealth returns healthy if getSlot is successful', async () => {
        const client = new RpcClient(endpoint);
        const health = await client.checkHealth();

        expect(health.isHealthy).toBe(true);
        expect(health.endpoint).toBe(endpoint);
        expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('checkHealth returens unhealthy if getSlot returns an error', async () => {
        mockRpc.getSlot.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('Connection refused')),
        });

        const client = new RpcClient(endpoint);
        const health = await client.checkHealth();

        expect(health.isHealthy).toBe(false);
        expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
});