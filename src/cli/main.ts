#!/usr/bin/env node

/**
 * CLI main entry point.
 *
 * Parses command-line arguments using commander and routes to appropriate commands.
 */

import { Command } from "commander";
import { fileURLToPath } from "url";
import { createHealthReport, watchHealth } from "./health.js";
import { createTransactionStatusReport } from "./status.js";
import { runSimulation } from "./simulate.js";

/**
 * Create and configure the Commander CLI instance.
 * Exported for testing.
 */
export function createCli(): Command {
  const program = new Command("solana-sdk")
    .description("Diagnostics CLI for Solana reliability SDK")
    .version(process.env["npm_package_version"] ?? "0.1.0");

  program
    .command("health")
    .description("Check RPC endpoint health")
    .argument("<endpoints...>", "RPC endpoint URLs")
    .option("--watch", "Poll continuously")
    .option("--interval-ms <ms>", "Poll interval in milliseconds", "5000")
    .option("--iterations <n>", "Number of health check iterations", "3")
    .action(async (endpoints: string[], opts) => {
      if (opts.watch) {
        const watchOpts: { intervalMs?: number; iterations?: number } = {};
        if (opts.intervalMs !== undefined) {
          watchOpts.intervalMs = Number(opts.intervalMs);
        }
        if (opts.iterations !== undefined) {
          watchOpts.iterations = Number(opts.iterations);
        }
        await watchHealth(endpoints, watchOpts);
        return;
      }

      const healthOpts: { iterations?: number } = {};
      if (opts.iterations !== undefined) {
        healthOpts.iterations = Number(opts.iterations);
      }
      const report = await createHealthReport(endpoints, healthOpts);

      console.log(report);
    });

  program
    .command("status")
    .description("Fetch transaction status")
    .argument("<signature>", "Transaction signature")
    .requiredOption("--endpoint <url>", "RPC endpoint URL")
    .action(async (signature: string, opts) => {
      const report = await createTransactionStatusReport(signature, opts.endpoint);
      console.log(report);
    });

  program
    .command("simulate")
    .description("Run network failure simulation")
    .action(async () => {
      const report = await runSimulation();
      if (report !== undefined) {
        console.log(report);
      }
    });

  return program;
}

// Check if running directly in executable mode
const isMain = (() => {
  try {
    const mainPath = process.argv[1];
    if (!mainPath) return false;
    const modulePath = fileURLToPath(import.meta.url);
    return modulePath === mainPath || import.meta.url === `file://${mainPath}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  createCli().parseAsync().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
