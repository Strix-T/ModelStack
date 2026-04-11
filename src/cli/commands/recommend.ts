import fs from "node:fs/promises";

import chalk from "chalk";
import ora from "ora";

import {
  getSystemProfile,
  recommendationResultToMarkdown,
  runRecommendationPipeline,
} from "../../app/recommendationPipeline.js";
import { exportJson } from "../../core/export/exportJson.js";
import { renderRecommendationReport } from "../../core/output/renderRecommendations.js";
import { runQuestionnaire } from "../../core/questionnaire/flows.js";

function createSpinner(enabled: boolean, text: string) {
  return enabled ? ora(text).start() : null;
}

function printSection(enabled: boolean, title: string, subtitle?: string) {
  if (!enabled) {
    return;
  }

  const suffix = subtitle ? `\n${chalk.gray(subtitle)}` : "";
  process.stdout.write(`\n${chalk.cyan.bold(title)}${suffix}\n\n`);
}

export async function runRecommendCommand(options: {
  json?: boolean;
  markdown?: string;
  offlineOnly?: boolean;
  fast?: boolean;
}): Promise<void> {
  const showSpinners = !options.json;

  const systemSpinner = createSpinner(showSpinners, "Scanning your system");
  systemSpinner?.start();
  const system = await getSystemProfile();
  systemSpinner?.succeed("System scan complete");

  printSection(showSpinners, "Collecting your goals", "A few quick questions to match the right stack.");
  const baseIntent = await runQuestionnaire();
  if (showSpinners) {
    process.stdout.write("\n");
  }

  const candidateSpinner = createSpinner(
    showSpinners,
    options.offlineOnly ? "Loading cached and seed candidates" : "Loading candidate registry and Hugging Face metadata",
  );
  const scoringSpinner = createSpinner(showSpinners, "Scoring bundle recommendations");

  const result = await runRecommendationPipeline({
    intent: baseIntent,
    system,
    offlineOnly: options.offlineOnly,
    fast: options.fast,
    onProgress: (p) => {
      if (p.phase === "scan_start") {
        candidateSpinner?.start();
      }
      if (p.phase === "candidates_start" && candidateSpinner) {
        candidateSpinner.text = options.offlineOnly
          ? "Loading cached and seed candidates"
          : "Loading candidate registry and Hugging Face metadata";
      }
      if (p.phase === "candidates_done") {
        candidateSpinner?.succeed("Candidate pool ready");
        scoringSpinner?.start();
      }
      if (p.phase === "score_start" && scoringSpinner) {
        scoringSpinner.text = "Scoring bundle recommendations";
      }
      if (p.phase === "score_done") {
        scoringSpinner?.succeed("Recommendations ready");
      }
    },
  });

  if (options.markdown) {
    await fs.writeFile(options.markdown, recommendationResultToMarkdown(result), "utf8");
  }

  if (options.json) {
    process.stdout.write(exportJson(result));
  } else {
    process.stdout.write(`${renderRecommendationReport(result)}\n`);
    if (options.markdown) {
      process.stdout.write(`\n${chalk.green(`Markdown report written to ${options.markdown}`)}\n`);
    }
  }
}
