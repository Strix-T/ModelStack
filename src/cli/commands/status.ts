import fs from "node:fs/promises";

import chalk from "chalk";

import { getSystemProfile } from "../../app/recommendationPipeline.js";
import { resolveBundleStartIndex } from "../../execution/applyStack.js";
import { collectOllamaPullTags, primaryOllamaRunTag } from "../../execution/ollamaTargets.js";
import { parseRecommendationResultJson } from "../../execution/parseRecommendation.js";
import type { SystemProfile } from "../../core/shared/types.js";

function formatRuntimesLine(system: SystemProfile): string {
  const r = system.runtimes;
  const names: string[] = [];
  if (r.ollamaInstalled) {
    names.push("Ollama");
  }
  if (r.llamaCppInstalled) {
    names.push("llama.cpp");
  }
  if (r.pythonInstalled) {
    names.push("Python");
  }
  if (r.lmStudioInstalled) {
    names.push("LM Studio");
  }
  if (r.dockerInstalled) {
    names.push("Docker");
  }
  if (r.mlxPythonInstalled) {
    names.push("MLX (Python)");
  }
  return names.length > 0 ? names.join(", ") : "none detected";
}

export async function runStatusCommand(options: { fromJson?: string; bundleLabel?: string }): Promise<void> {
  const system = await getSystemProfile();

  process.stdout.write(`\n${chalk.cyan.bold("ModelStack status")}\n\n`);
  process.stdout.write(`${chalk.bold("OS:")} ${system.os}\n`);
  process.stdout.write(`${chalk.bold("CPU:")} ${system.cpuModel} (${system.cpuCores} cores)\n`);
  process.stdout.write(
    `${chalk.bold("RAM:")} ${system.ramGb} GB total${system.freeRamGb !== undefined ? `, ${system.freeRamGb} GB free (at scan)` : ""}\n`,
  );
  process.stdout.write(
    `${chalk.bold("GPU:")} ${system.gpuModel ?? "Unknown"}${system.gpuVramGb ? ` (${system.gpuVramGb} GB)` : ""}\n`,
  );
  if (system.storageFreeGb !== undefined) {
    process.stdout.write(`${chalk.bold("Storage free:")} ${system.storageFreeGb} GB\n`);
  }
  process.stdout.write(`${chalk.bold("Runtimes:")} ${formatRuntimesLine(system)}\n`);

  if (options.fromJson) {
    const raw = await fs.readFile(options.fromJson, "utf8");
    const parsed = parseRecommendationResultJson(raw);
    if (!parsed.ok) {
      process.stderr.write(`${chalk.red(parsed.error)}\n`);
      process.exitCode = 1;
      return;
    }
    if (parsed.data.bundles.length === 0) {
      process.stdout.write(`\n${chalk.yellow("Recommendation file has no bundles.")}\n`);
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
    process.stdout.write(`\n${chalk.cyan.bold("Dry run (from recommendation file)")}\n`);
    process.stdout.write(`${chalk.bold("Bundle:")} ${bundle.label.replaceAll("_", " ")}\n`);
    process.stdout.write(`${chalk.bold("Engine:")} ${bundle.recommendedEngine}\n`);

    if (bundle.recommendedEngine === "ollama") {
      const tags = collectOllamaPullTags(bundle);
      const runTag = primaryOllamaRunTag(bundle);
      if (tags.length > 0) {
        process.stdout.write(`${chalk.bold("Would run:")}\n`);
        for (const t of tags) {
          process.stdout.write(`  ${chalk.gray(`ollama pull ${t}`)}\n`);
        }
      } else {
        process.stdout.write(`${chalk.yellow("No ollama pull tags inferred from this bundle.")}\n`);
      }
      if (runTag) {
        process.stdout.write(`${chalk.bold("`modelstack chat` would use:")} ${chalk.gray(`ollama run ${runTag}`)}\n`);
      }
    } else {
      process.stdout.write(`${chalk.gray("Apply would write a project folder and print guided setup steps for this engine.")}\n`);
    }
  }

  process.stdout.write("\n");
}
