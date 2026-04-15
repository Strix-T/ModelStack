#!/usr/bin/env node
import { Command } from "commander";

import { runApplyCommand } from "./commands/apply.js";
import { runChatCommand } from "./commands/chat.js";
import { runIngestCommand } from "./commands/ingest.js";
import { runQuestionnaireCommand } from "./commands/questionnaire.js";
import { runRecommendCommand } from "./commands/recommend.js";
import { runRefreshCacheCommand } from "./commands/refresh-cache.js";
import { runScanCommand } from "./commands/scan.js";
import { runStatusCommand } from "./commands/status.js";

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

program
  .command("apply")
  .description("Apply a saved recommendation: verify the machine, pull Ollama models when possible, and create a project folder.")
  .requiredOption("--from-json <path>", "Path to JSON from `modelstack recommend --json`")
  .option(
    "--bundle-label <label>",
    "Which bundle to start from (best_overall, fastest, best_quality, most_local_friendly). Falls forward if it no longer fits.",
  )
  .option("--project-dir <path>", "Directory for config and data (default: ./modelstack-project)", "modelstack-project")
  .option("-y, --yes", "Skip interactive confirmation for large downloads")
  .action(async (options) => {
    await runApplyCommand({
      fromJson: options.fromJson,
      bundleLabel: options.bundleLabel,
      projectDir: options.projectDir,
      yes: options.yes,
    });
  });

program
  .command("status")
  .description("Show runtime detection and optional dry-run Ollama pulls from a recommendation file.")
  .option("--from-json <path>", "Recommendation JSON to summarize")
  .option("--bundle-label <label>", "Bundle label when using --from-json")
  .action(async (options) => {
    await runStatusCommand({
      fromJson: options.fromJson,
      bundleLabel: options.bundleLabel,
    });
  });

program
  .command("chat")
  .description("Start an interactive Ollama chat using the primary model tag from a recommendation file.")
  .requiredOption("--from-json <path>", "Path to JSON from `modelstack recommend --json`")
  .option("--bundle-label <label>", "Bundle label (default: first bundle in the file)")
  .action(async (options) => {
    await runChatCommand({
      fromJson: options.fromJson,
      bundleLabel: options.bundleLabel,
    });
  });

program
  .command("ingest")
  .description("Document ingestion (planned; not yet implemented).")
  .option("--project-dir <path>", "Project directory (default: ./modelstack-project)", "modelstack-project")
  .action(async (options) => {
    await runIngestCommand({ projectDir: options.projectDir });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
