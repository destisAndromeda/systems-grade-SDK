# Landing Simulation Results

> Generated: 2026-06-15T10:48:08.092Z
>
> **A** = Naive single-RPC (one endpoint, no retry, no circuit-breaker)  
> **B** = SDK resilient routing (retry + circuit-breaker + best-endpoint selection)

| Scenario | A landed | A attempts | A latency | B landed | B attempts | B latency |
|----------|:--------:|:----------:|----------:|:--------:|:----------:|----------:|
| Happy path | ✅ | 1 | 0 ms | ✅ | 1 | 1 ms |
| Timeout → retry succeeds | ❌ | 1 | 0 ms | ✅ | 2 | 3 ms |
| Rate-limit → fallback endpoint | ❌ | 1 | 0 ms | ✅ | 2 | 2 ms |
| Slot lag → failover | ❌ | 1 | 0 ms | ✅ | 2 | 2 ms |
| Total network failure | ❌ | 1 | 0 ms | ❌ | 4 | 4 ms |
| Flaky endpoint (3 timeouts, 4th ok) | ❌ | 1 | 0 ms | ✅ | 4 | 4 ms |

## Summary

| Outcome | Scenarios |
|---------|:---------:|
| SDK lands, naive fails | **4** |
| Both land | **1** |
| Naive lands, SDK fails | **0** |
| Neither lands | **1** |
