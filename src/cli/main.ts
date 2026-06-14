/**
 * CLI main entry point.
 *
 * Parses command-line arguments and routes to appropriate commands.
 */

import { createHealthReport, createActiveHealthReport, watchHealth } from "./health.js";
import { runSimulation } from "./simulate.js";
import { createTransactionStatusReport } from "./status.js";

// ---------------------------------------------------------------------------
// Argument parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a flag value from argv.
 * Returns the string value following the flag name, or undefined.
 */
function parseFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

/**
 * Check if a flag (e.g. "--watch") is present in argv.
 */
function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

/**
 * Parse a positive integer flag value.
 * Writes error and sets exitCode on failure.
 */
function parsePositiveInt(
  args: string[],
  flag: string,
): { value?: number; error?: string } {
  const raw = parseFlagValue(args, flag);
  if (raw === undefined) return {};
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { error: `Invalid value for ${flag}: "${raw}" must be a positive integer` };
  }
  return { value: n };
}

// ---------------------------------------------------------------------------
// Usage text
// ---------------------------------------------------------------------------

const USAGE = `\
Usage: solana-reliability-sdk <command> [args...]

Commands:
  health [--watch] [--interval-ms <ms>] [--iterations <n>] <endpoint1> [endpoint2...]
      Check RPC endpoint health. With --watch, poll repeatedly.

  status <signature> --endpoint <rpc-url>
      Fetch transaction status using getSignatureStatuses.

  simulate
      Run deterministic reliability simulation.
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Main CLI entry point.
 *
 * Parses process.argv and routes to the appropriate command.
 * Uses process.exitCode instead of process.exit() so async code can finish.
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(USAGE);
    process.exitCode = 0;
    return;
  }

  const command = args[0];
  const rest = args.slice(1);

  try {
    switch (command) {
      // ------------------------------------------------------------------
      case "health": {
        // Known flags for this command
        const knownFlags = new Set(["--watch", "--interval-ms", "--iterations"]);

        // Collect unknown flags (anything starting with -- that is not known)
        const unknownFlags = rest.filter((a) => a.startsWith("--") && !knownFlags.has(a));
        if (unknownFlags.length > 0) {
          console.error(`Unknown flag(s): ${unknownFlags.join(", ")}`);
          console.error("Run without arguments to see usage.");
          process.exitCode = 1;
          return;
        }

        // Parse numeric flags
        const intervalResult = parsePositiveInt(rest, "--interval-ms");
        if (intervalResult.error) {
          console.error(intervalResult.error);
          process.exitCode = 1;
          return;
        }

        const iterResult = parsePositiveInt(rest, "--iterations");
        if (iterResult.error) {
          console.error(iterResult.error);
          process.exitCode = 1;
          return;
        }

        // Collect endpoint arguments (non-flag tokens)
        const knownFlagsTakingValue = new Set(["--interval-ms", "--iterations"]);
        const endpoints: string[] = [];
        let skipNext = false;
        for (const token of rest) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          if (knownFlagsTakingValue.has(token)) {
            skipNext = true;
            continue;
          }
          if (!token.startsWith("--")) {
            endpoints.push(token);
          }
        }

        const watch = hasFlag(rest, "--watch");

        if (watch) {
          const watchOptions: import("./health.js").HealthWatchOptions = {};
          if (intervalResult.value !== undefined) watchOptions.intervalMs = intervalResult.value;
          if (iterResult.value !== undefined) watchOptions.iterations = iterResult.value;
          await watchHealth(endpoints, watchOptions);
        } else {
          const report = await createActiveHealthReport(endpoints);
          console.log(report);
        }
        break;
      }

      // ------------------------------------------------------------------
      case "status": {
        // Expect: status <signature> --endpoint <url>
        // Also accept --endpoint-url and --rpc as aliases

        const knownFlags = new Set(["--endpoint", "--endpoint-url", "--rpc"]);
        const unknownFlags = rest.filter(
          (a) => a.startsWith("--") && !knownFlags.has(a),
        );
        if (unknownFlags.length > 0) {
          console.error(`Unknown flag(s): ${unknownFlags.join(", ")}`);
          console.error("Run without arguments to see usage.");
          process.exitCode = 1;
          return;
        }

        // Signature is first non-flag token
        const signature = rest.find((a) => !a.startsWith("--"));
        if (!signature) {
          console.error("Missing <signature>.");
          console.error(`Usage: solana-reliability-sdk status <signature> --endpoint <rpc-url>`);
          process.exitCode = 1;
          return;
        }

        const endpointUrl =
          parseFlagValue(rest, "--endpoint") ??
          parseFlagValue(rest, "--endpoint-url") ??
          parseFlagValue(rest, "--rpc");

        if (!endpointUrl) {
          console.error("Missing --endpoint <rpc-url>.");
          console.error(`Usage: solana-reliability-sdk status <signature> --endpoint <rpc-url>`);
          process.exitCode = 1;
          return;
        }

        const report = await createTransactionStatusReport(signature, { endpointUrl });
        console.log(report);
        break;
      }

      // ------------------------------------------------------------------
      case "simulate": {
        const result = await runSimulation();
        console.log(result);
        break;
      }

      // ------------------------------------------------------------------
      default: {
        console.error(`Unknown command: ${command}`);
        console.error("Run without arguments to see usage.");
        process.exitCode = 1;
        break;
      }
    }
  } catch (error) {
    console.error("CLI error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

// Run CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  });
}
