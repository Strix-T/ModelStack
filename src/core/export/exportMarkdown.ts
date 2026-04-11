import { formatGbForDisplay } from "../shared/formatGb.js";
import type { RecommendationResult } from "../shared/types.js";

function formatModelMd(model: RecommendationResult["bundles"][number]["textModel"]): string {
  if (!model) {
    return "None";
  }
  return `${model.id} (${model.source}, metadata confidence: ${model.discoveryConfidence})`;
}

function renderBundleMarkdown(result: RecommendationResult["bundles"][number]): string {
  return [
    `## ${result.label.replaceAll("_", " ")}`,
    "",
    `- Text Model: ${formatModelMd(result.textModel)}`,
    `- Embedding Model: ${formatModelMd(result.embeddingModel)}`,
    `- Vision Model: ${formatModelMd(result.visionModel)}`,
    `- Image Model: ${formatModelMd(result.imageModel)}`,
    `- Load Strategy: ${result.loadStrategy}`,
    ...(result.fitState ? [`- Fit State: ${result.fitState.replaceAll("_", " ")}`] : []),
    `- Peak RAM: ${formatGbForDisplay(result.estimatedPeakRamGb)} GB (heuristic estimate)`,
    `- Peak VRAM: ${result.estimatedPeakVramGb ? `${formatGbForDisplay(result.estimatedPeakVramGb)} GB (heuristic estimate)` : "n/a"}`,
    `- Fit Confidence: ${result.fitConfidence}`,
    ...(result.memoryEstimateSource ? [`- Memory estimate basis: ${result.memoryEstimateSource.replaceAll("_", " ")}`] : []),
    "",
    "### Why this fits",
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    ...(result.whyHeldBack && result.whyHeldBack.length > 0
      ? ["### What was skipped or de-prioritized", ...result.whyHeldBack.map((line) => `- ${line}`), ""]
      : []),
    "### Warnings",
    ...(result.warnings.length > 0 ? result.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "### Next steps",
    ...result.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

export function exportMarkdown(result: RecommendationResult): string {
  const bundleSections =
    result.bundles.length > 0
      ? result.bundles.flatMap((b) => ["", renderBundleMarkdown(b)])
      : [
          "",
          "## No viable bundle",
          "",
          ...(result.noFitExplanations ?? []).map((line) => `- ${line}`),
        ];

  return [
    "# ModelStack Recommendation Report",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## System Summary",
    `- OS: ${result.system.os}`,
    `- CPU: ${result.system.cpuModel} (${result.system.cpuCores} cores)`,
    `- RAM: ${result.system.ramGb} GB total${result.system.freeRamGb !== undefined ? `, ${result.system.freeRamGb} GB free (at scan)` : ""}`,
    `- GPU: ${result.system.gpuModel ?? "Unknown"}${result.system.gpuVramGb ? ` (${result.system.gpuVramGb} GB discrete)` : ""}`,
    `- Unified memory: ${result.system.unifiedMemoryGb !== undefined ? `${result.system.unifiedMemoryGb} GB (Apple Silicon — shared CPU/GPU pool)` : "n/a"}`,
    `- Storage free: ${result.system.storageFreeGb !== undefined ? `${result.system.storageFreeGb} GB` : "Unknown"}`,
    `- Detection confidence: ${result.system.confidence}`,
    `- Hardware band: ${result.system.hardwareBand}`,
    `- Runtimes detected: ${[
      result.system.runtimes.ollamaInstalled ? "Ollama" : null,
      result.system.runtimes.llamaCppInstalled ? "llama.cpp" : null,
      result.system.runtimes.pythonInstalled ? "Python" : null,
    ]
      .filter(Boolean)
      .join(", ") || "none"}`,
    ...(result.system.detectionWarnings.length > 0
      ? ["", "**Hardware notes:**", ...result.system.detectionWarnings.map((w) => `- ${w}`)]
      : []),
    "",
    "## What You Told Us",
    `- Use cases: ${result.intent.primaryUseCases.join(", ")}`,
    `- Input types: ${result.intent.inputTypes.join(", ")}`,
    `- Priority: ${result.intent.priority}`,
    `- Local preference: ${result.intent.localPreference}`,
    ...bundleSections,
    "",
    "## Global Warnings",
    ...(result.cacheWarnings.length > 0 ? result.cacheWarnings.map((warning) => `- ${warning}`) : ["- None"]),
  ].join("\n");
}
