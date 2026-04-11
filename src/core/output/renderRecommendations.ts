import chalk from "chalk";

import type { CandidateModel, RecommendationResult, RecommendedBundle, UserIntent } from "../shared/types.js";
import { formatGbForDisplay } from "../shared/formatGb.js";
import { renderHeader } from "./renderHeader.js";
import { renderSystem } from "./renderSystem.js";
import { renderKeyValueTable } from "./renderTables.js";
import { renderWarnings } from "./renderWarnings.js";

function renderIntent(intent: UserIntent): string {
  return renderKeyValueTable([
    ["Primary Use Cases", intent.primaryUseCases.join(", ").replaceAll("_", " ")],
    ["Input Types", intent.inputTypes.join(", ").replaceAll("_", " ")],
    ["Priority", intent.priority],
    ["Local Preference", intent.localPreference.replaceAll("_", " ")],
    ["Slow Smart Models", intent.allowsSlowSmart ? "Allowed" : "Avoid when possible"],
  ]);
}

function formatModelLine(model: CandidateModel | undefined): string {
  if (!model) {
    return "None";
  }
  const src = model.source === "seed" ? "curated seed" : model.source;
  return `${model.id} (${src}, metadata confidence: ${model.discoveryConfidence})`;
}

function renderBundle(bundle: RecommendedBundle): string {
  const rows: [string, string][] = [
    ["Label", bundle.label.replaceAll("_", " ")],
    ["Text Model", formatModelLine(bundle.textModel)],
    ["Embedding Model", formatModelLine(bundle.embeddingModel)],
    ["Vision Model", formatModelLine(bundle.visionModel)],
    ["Image Model", formatModelLine(bundle.imageModel)],
    ["Load Strategy", bundle.loadStrategy],
  ];
  if (bundle.fitState) {
    rows.push(["Fit State", bundle.fitState.replaceAll("_", " ")]);
  }
  rows.push(
    ["Peak RAM", `${formatGbForDisplay(bundle.estimatedPeakRamGb)} GB (heuristic estimate)`],
    ["Peak VRAM", bundle.estimatedPeakVramGb ? `${formatGbForDisplay(bundle.estimatedPeakVramGb)} GB (heuristic estimate)` : "n/a"],
    ["Fit Confidence", bundle.fitConfidence],
  );
  if (bundle.memoryEstimateSource) {
    rows.push(["Memory estimate basis", bundle.memoryEstimateSource.replaceAll("_", " ")]);
  }
  const table = renderKeyValueTable(rows);

  return [
    chalk.bold(bundle.label.replaceAll("_", " ")),
    table,
    "Why this fits:",
    ...bundle.reasons.map((reason) => `- ${reason}`),
    ...(bundle.whyHeldBack && bundle.whyHeldBack.length > 0
      ? ["What was skipped or de-prioritized:", ...bundle.whyHeldBack.map((line) => `- ${line}`)]
      : []),
    ...(bundle.warnings.length > 0 ? ["Tradeoffs:", ...bundle.warnings.map((warning) => `- ${warning}`)] : []),
    "Next steps:",
    ...bundle.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

export function renderRecommendationReport(result: RecommendationResult): string {
  const sections = [
    renderHeader("ModelStack", "Smart local AI setup planner"),
    chalk.cyan.bold("System Summary"),
    renderSystem(result.system),
    chalk.cyan.bold("What You Told Us"),
    renderIntent(result.intent),
    chalk.cyan.bold("Recommended Stacks"),
    ...(result.bundles.length > 0
      ? result.bundles.map(renderBundle)
      : [
          chalk.yellow("No viable bundle was found for this system profile and goals."),
          ...(result.noFitExplanations ?? []).map((line) => `- ${line}`),
        ]),
  ];

  const combinedWarnings = [...result.cacheWarnings, ...result.system.detectionWarnings];
  if (combinedWarnings.length > 0) {
    sections.push(renderWarnings(combinedWarnings));
  }

  return sections.join("\n\n");
}
