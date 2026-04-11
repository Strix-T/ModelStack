import type { CandidateModel, LoadStrategy, SystemProfile } from "../shared/types.js";
import { chooseLoadStrategy } from "../shared/utils.js";

export function chooseBundleLoadStrategy(
  system: SystemProfile,
  parts: {
    textModel?: CandidateModel;
    embeddingModel?: CandidateModel;
    visionModel?: CandidateModel;
    imageModel?: CandidateModel;
  },
): LoadStrategy {
  const secondaryCount = [parts.visionModel, parts.imageModel].filter(Boolean).length;
  const baseline = chooseLoadStrategy(system, secondaryCount > 0);

  if (baseline === "always_loaded") {
    const peakRam = estimatePeakRam(parts, baseline);
    const unified = system.unifiedMemoryGb;
    const budget =
      unified !== undefined
        ? Math.min(system.freeRamGb ?? system.ramGb, unified * 0.78)
        : (system.freeRamGb ?? system.ramGb * 0.8);
    if (peakRam > budget) {
      return "on_demand_secondary";
    }
  }

  return baseline;
}

function adjustedRamGb(model: CandidateModel | undefined, useRecommended: boolean): number {
  if (!model) {
    return 0;
  }
  const base = useRecommended ? model.memoryProfile.recommendedRamGb : model.memoryProfile.minRamGb;
  const ggufLean = model.formats.includes("gguf") ? 0.88 : 1;
  return base * ggufLean;
}

export function estimatePeakRam(
  parts: {
    textModel?: CandidateModel;
    embeddingModel?: CandidateModel;
    visionModel?: CandidateModel;
    imageModel?: CandidateModel;
  },
  loadStrategy: LoadStrategy,
): number {
  const ramValues = [
    adjustedRamGb(parts.textModel, true),
    adjustedRamGb(parts.embeddingModel, true),
    adjustedRamGb(parts.visionModel, true),
    adjustedRamGb(parts.imageModel, true),
  ];

  if (loadStrategy === "always_loaded") {
    return ramValues.reduce((sum, value) => sum + value, 0);
  }

  if (loadStrategy === "on_demand_secondary") {
    const secondaryPeak = Math.max(adjustedRamGb(parts.visionModel, true), adjustedRamGb(parts.imageModel, true));
    return adjustedRamGb(parts.textModel, true) + adjustedRamGb(parts.embeddingModel, false) + secondaryPeak;
  }

  if (loadStrategy === "lightweight_all_local") {
    return [
      adjustedRamGb(parts.textModel, false),
      adjustedRamGb(parts.embeddingModel, false),
      adjustedRamGb(parts.visionModel, false),
      adjustedRamGb(parts.imageModel, false),
    ].reduce((sum, value) => sum + value, 0);
  }

  return Math.max(
    adjustedRamGb(parts.textModel, false),
    adjustedRamGb(parts.embeddingModel, false),
    adjustedRamGb(parts.visionModel, false),
    adjustedRamGb(parts.imageModel, false),
  );
}

export function estimatePeakVram(
  parts: {
    textModel?: CandidateModel;
    embeddingModel?: CandidateModel;
    visionModel?: CandidateModel;
    imageModel?: CandidateModel;
  },
  loadStrategy: LoadStrategy,
): number | undefined {
  const vramValues = [
    parts.textModel?.memoryProfile.recommendedVramGb ?? 0,
    parts.embeddingModel?.memoryProfile.recommendedVramGb ?? 0,
    parts.visionModel?.memoryProfile.recommendedVramGb ?? 0,
    parts.imageModel?.memoryProfile.recommendedVramGb ?? 0,
  ];

  const total = loadStrategy === "always_loaded" ? vramValues.reduce((sum, value) => sum + value, 0) : Math.max(...vramValues);
  return total > 0 ? total : undefined;
}
