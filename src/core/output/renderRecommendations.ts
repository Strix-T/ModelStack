import chalk from "chalk";

import { getEngineDefinition } from "../engines/engineRegistry.js";
import { describeLocalPreference } from "../questionnaire/questions.js";
import type { CandidateModel, EngineId, RecommendationResult, RecommendedBundle, UserIntent } from "../shared/types.js";
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
    ["Ease of running on this computer", describeLocalPreference(intent.localPreference)],
    [
      "Preferred Engine",
      intent.preferredEngine === "auto" ? "Recommend for me" : getEngineDefinition(intent.preferredEngine as EngineId).label,
    ],
    ["Install Comfort", intent.installComfort],
    ["Format Preference", intent.formatPreference],
    ["Context", intent.contextPreference.replaceAll("_", " ")],
    ["Quantization", intent.quantizationTolerance.replaceAll("_", " ")],
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
    ["Stack archetype", bundle.stackArchetype ?? "—"],
    ["Recommended engine", getEngineDefinition(bundle.recommendedEngine).label],
    ["Fallback engine", getEngineDefinition(bundle.fallbackEngine).label],
    ["Text variant", bundle.selectedTextVariant ? `${bundle.selectedTextVariant.quantLabel ?? bundle.selectedTextVariant.precision} (${bundle.selectedTextVariant.format})` : "default profile"],
    ["Text Model", formatModelLine(bundle.textModel)],
    ["Embedding Model", formatModelLine(bundle.embeddingModel)],
    ["Vision Model", formatModelLine(bundle.visionModel)],
    ["Image Model", formatModelLine(bundle.imageModel)],
    ["Reranker", formatModelLine(bundle.rerankerModel)],
    ["Speech-to-text", formatModelLine(bundle.speechToTextModel)],
    ["Text-to-speech", formatModelLine(bundle.textToSpeechModel)],
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
  if (bundle.memoryBreakdown) {
    rows.push([
      "Memory breakdown (est.)",
      `base ${formatGbForDisplay(bundle.memoryBreakdown.baseModelRamGb)} GB + engine ${formatGbForDisplay(bundle.memoryBreakdown.engineOverheadGb)} GB + KV ${formatGbForDisplay(bundle.memoryBreakdown.kvCacheRamGb)} GB + secondaries ${formatGbForDisplay(bundle.memoryBreakdown.secondaryModelsRamGb)} GB`,
    ]);
  }
  const table = renderKeyValueTable(rows);

  return [
    chalk.bold(bundle.label.replaceAll("_", " ")),
    table,
    ...(bundle.scoreExplanation && bundle.scoreExplanation.length > 0
      ? ["Score notes:", ...bundle.scoreExplanation.map((line) => `- ${line}`)]
      : []),
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
