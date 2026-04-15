import fs from "node:fs/promises";

import chalk from "chalk";
import { execa } from "execa";

import { primaryOllamaRunTag } from "../../execution/ollamaTargets.js";
import { parseRecommendationResultJson } from "../../execution/parseRecommendation.js";
import { resolveBundleStartIndex } from "../../execution/applyStack.js";
import { buildInstallSteps } from "../../core/output/installSteps.js";
import { formatExecutionError } from "../../execution/errorHandler.js";

export async function runChatCommand(options: { fromJson: string; bundleLabel?: string }): Promise<void> {
  const debug = process.env.MODELSTACK_DEBUG === "1";
  const raw = await fs.readFile(options.fromJson, "utf8");
  const parsed = parseRecommendationResultJson(raw);
  if (!parsed.ok) {
    process.stderr.write(`${chalk.red(parsed.error)}\n`);
    process.exitCode = 1;
    return;
  }

  if (parsed.data.bundles.length === 0) {
    process.stderr.write(`${chalk.red("No bundles in this recommendation file.")}\n`);
    process.exitCode = 1;
    return;
  }

  let start: number;
  try {
    start = resolveBundleStartIndex(parsed.data.bundles, options.bundleLabel);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`${chalk.red(msg)}\n`);
    process.exitCode = 1;
    return;
  }

  const bundle = parsed.data.bundles[start]!;

  if (bundle.recommendedEngine !== "ollama") {
    process.stderr.write(
      `${chalk.yellow("Chat automation is only wired for Ollama in this version.")}\n\n${chalk.bold("Setup steps:")}\n`,
    );
    const steps = buildInstallSteps(bundle.recommendedEngine, {
      textModel: bundle.textModel,
      embeddingModel: bundle.embeddingModel,
      visionModel: bundle.visionModel,
      imageModel: bundle.imageModel,
      rerankerModel: bundle.rerankerModel,
    }, bundle.selectedTextVariant);
    for (const s of steps) {
      process.stderr.write(`- ${s}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const tag = primaryOllamaRunTag(bundle);
  if (!tag) {
    process.stderr.write(
      `${chalk.yellow("No Ollama model tag was found in this bundle. Pull a model first, then run ollama run <tag> yourself.")}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.cyan(`Starting ollama run ${tag}…`)}\n`);
  process.stdout.write(`${chalk.gray("(Exit the chat with Ctrl+D or /bye depending on your Ollama build.)")}\n\n`);

  try {
    await execa("ollama", ["run", tag], { stdio: "inherit" });
  } catch (err) {
    process.stderr.write(`${chalk.red(formatExecutionError(err, debug))}\n`);
    process.exitCode = 1;
  }
}
