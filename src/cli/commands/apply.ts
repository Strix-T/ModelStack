import fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";

import { getSystemProfile } from "../../app/recommendationPipeline.js";
import { applyStack } from "../../execution/applyStack.js";
import { formatExecutionError } from "../../execution/errorHandler.js";
import { parseRecommendationResultJson } from "../../execution/parseRecommendation.js";

export async function runApplyCommand(options: {
  fromJson: string;
  bundleLabel?: string;
  projectDir?: string;
  yes?: boolean;
}): Promise<void> {
  const raw = await fs.readFile(options.fromJson, "utf8");
  const parsed = parseRecommendationResultJson(raw);
  if (!parsed.ok) {
    process.stderr.write(`${chalk.red(parsed.error)}\n`);
    if (parsed.details) {
      process.stderr.write(`${parsed.details}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const projectDir = path.resolve(process.cwd(), options.projectDir ?? "modelstack-project");
  const debug = process.env.MODELSTACK_DEBUG === "1";

  process.stdout.write(`\n${chalk.cyan.bold("Apply stack")}\n`);
  process.stdout.write(`${chalk.gray("Live system check + setup for your chosen bundle.")}\n\n`);

  let lastProgress = "";
  try {
    const liveSystem = await getSystemProfile();
    const result = await applyStack({
      result: parsed.data,
      liveSystem,
      projectDir,
      bundleLabel: options.bundleLabel,
      assumeYes: Boolean(options.yes),
      onProgressText: (summary) => {
        lastProgress = summary;
        process.stdout.write(`\n${summary}\n\n`);
      },
    });

    if (!result.success) {
      process.stderr.write(`${chalk.yellow(result.reason)}\n`);
      if (result.skippedBundleLabels.length > 0) {
        process.stderr.write(
          `${chalk.gray(`Bundles skipped during fit check: ${result.skippedBundleLabels.join(", ")}`)}\n`,
        );
      }
      process.exitCode = 1;
      return;
    }

    process.stdout.write(`${chalk.green.bold("Done")}\n`);
    process.stdout.write(`${chalk.gray(`Bundle: ${result.bundle.label.replaceAll("_", " ")}`)}`);
    process.stdout.write(`${chalk.gray(` · Mode: ${result.mode}`)}\n\n`);
    for (const line of result.notes) {
      process.stdout.write(`${line}\n`);
    }
    process.stdout.write("\n");
    if (lastProgress) {
      process.stdout.write(`${chalk.gray(lastProgress)}\n\n`);
    }
  } catch (err) {
    process.stderr.write(`${chalk.red(formatExecutionError(err, debug))}\n`);
    process.exitCode = 1;
  }
}
