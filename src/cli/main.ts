/**
 * CLI main entry point.
 *
 * Parses command-line arguments and routes to appropriate commands.
 */

import { createHealthReport } from "./health.js";
import { runSimulation } from "./simulate.js";

/**
 * Main CLI entry point.
 *
 * Usage:
 *  - `solana-reliability-sdk health [endpoint-urls...]`
 *  - `solana-reliability-sdk simulate`
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: solana-reliability-sdk <command> [args...]");
    console.log("\nCommands:");
    console.log("  health [endpoint1] [endpoint2] ...  Check RPC endpoint health");
    console.log("  simulate                             Run reliability simulation");
    process.exitCode = 0;
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case "health": {
        const endpoints = args.slice(1);
        const report = createHealthReport(endpoints);
        console.log(report);
        break;
      }

      case "simulate": {
        const result = await runSimulation();
        console.log(result);
        break;
      }

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
