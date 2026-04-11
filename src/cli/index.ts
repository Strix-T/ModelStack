#!/usr/bin/env node
import { Command } from "commander";

import { runQuestionnaireCommand } from "./commands/questionnaire.js";
import { runRecommendCommand } from "./commands/recommend.js";
import { runRefreshCacheCommand } from "./commands/refresh-cache.js";
import { runScanCommand } from "./commands/scan.js";

const program = new Command();

program
  .name("modelstack")
  .description("A smart local AI setup planner for real computers.")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan the local machine and print a normalized system profile.")
  .option("--json", "Print raw JSON output")
  .action(async (options) => {
    await runScanCommand(options);
  });

program
  .command("questionnaire")
  .description("Run the adaptive questionnaire and print the normalized intent.")
  .option("--json", "Print raw JSON output")
  .action(async (options) => {
    await runQuestionnaireCommand(options);
  });

const cache = program.command("cache").description("Manage local ModelStack cache data.");
cache
  .command("refresh")
  .description("Refresh the bounded Hugging Face candidate cache.")
  .option("--force", "Present for future compatibility; refresh always fetches latest metadata in v1.")
  .action(async (options) => {
    await runRefreshCacheCommand(options);
  });

program
  .command("recommend")
  .description("Scan the machine, ask questions, and recommend the best local model stacks.")
  .option("--json", "Print structured JSON output instead of the terminal report")
  .option("--markdown <path>", "Write a Markdown report to the given path")
  .option("--offline-only", "Use only seed and cached model data; skip network discovery")
  .option("--fast", "Bias the recommendation flow toward faster responses")
  .action(async (options) => {
    await runRecommendCommand(options);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
