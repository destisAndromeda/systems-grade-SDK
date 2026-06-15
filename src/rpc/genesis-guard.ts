/**
 * Genesis guard for endpoint network safety.
 */

export interface GenesisGuardEndpoint {
  id: string;
  url: string;
}

export interface GenesisGuardTransport {
  send<TParams extends unknown[], TResult>(
    method: string,
    params: TParams,
  ): Promise<TResult>;
}

export interface GenesisGuardResult<TEndpoint extends GenesisGuardEndpoint> {
  valid: TEndpoint[];
  quarantined: TEndpoint[];
  genesisHash?: string;
  warning?: string;
}

/**
 * Verifies RPC endpoints by querying their genesis hash and grouping them.
 * Selects the majority genesis network group, and quarantines others.
 */
export async function buildVerifiedEndpointPool<TEndpoint extends GenesisGuardEndpoint>(
  endpoints: TEndpoint[],
  transports: Map<string, GenesisGuardTransport>,
): Promise<GenesisGuardResult<TEndpoint>> {
  if (endpoints.length === 0) {
    return {
      valid: [],
      quarantined: [],
    };
  }

  const results = await Promise.all(
    endpoints.map(async (ep) => {
      const transport = transports.get(ep.id);
      if (!transport) {
        return {
          endpoint: ep,
          success: false,
          error: new Error(`No transport found for endpoint ${ep.id}`),
        };
      }
      try {
        const hash = await transport.send<[], string>("getGenesisHash", []);
        if (typeof hash !== "string" || !hash) {
          return {
            endpoint: ep,
            success: false,
            error: new Error("Invalid or empty genesis hash returned"),
          };
        }
        return {
          endpoint: ep,
          success: true,
          hash,
        };
      } catch (err) {
        return {
          endpoint: ep,
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    }),
  );

  const successful = results.filter(
    (r): r is { endpoint: TEndpoint; success: true; hash: string } => r.success,
  );

  if (successful.length === 0) {
    // If no endpoint can be verified, return original endpoints as valid with a warning
    return {
      valid: [...endpoints],
      quarantined: [],
      warning: "Quarantined 0 RPC endpoint(s) with non-majority or unverifiable genesis hash",
    };
  }

  // Count occurrences of each genesis hash
  const counts = new Map<string, number>();
  for (const r of successful) {
    counts.set(r.hash, (counts.get(r.hash) || 0) + 1);
  }

  // Find the majority genesis hash
  let majorityHash = "";
  let maxCount = 0;
  for (const [hash, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      majorityHash = hash;
    }
  }

  const valid: TEndpoint[] = [];
  const quarantined: TEndpoint[] = [];

  for (const r of results) {
    if (r.success && r.hash === majorityHash) {
      valid.push(r.endpoint);
    } else {
      quarantined.push(r.endpoint);
    }
  }

  const result: GenesisGuardResult<TEndpoint> = {
    valid,
    quarantined,
    genesisHash: majorityHash,
  };

  if (quarantined.length > 0) {
    result.warning = `Quarantined ${quarantined.length} RPC endpoint(s) with non-majority or unverifiable genesis hash`;
  }

  return result;
}
