import type { CandidateModel, SystemProfile } from "../shared/types.js";
import { practicalRamHeadroomFactor } from "./eligibility.js";

function discoveryConfidenceMultiplier(candidate: CandidateModel): number {
  if (candidate.source === "seed" || candidate.source === "enriched") {
    return 1;
  }
  switch (candidate.discoveryConfidence) {
    case "high":
      return 1;
    case "medium":
      return 0.97;
    case "low":
      return 0.92;
    default:
      return 1;
  }
}

/**
 * Favor models with stronger Hugging Face engagement (downloads/likes), log-scaled.
 * Curated seeds are not penalized (editorial trust). Discovered/enriched without stats get a mild penalty.
 */
export function getCommunityReachMultiplier(candidate: CandidateModel): number {
  if (candidate.source === "seed") {
    return 1;
  }

  const downloads = candidate.hfDownloads ?? 0;
  const likes = candidate.hfLikes ?? 0;
  if (downloads === 0 && likes === 0) {
    return 0.82;
  }

  const dNorm = Math.min(1, Math.log10(1 + downloads) / Math.log10(1 + 500_000));
  const lNorm = Math.min(1, Math.log10(1 + likes) / Math.log10(1 + 15_000));
  const engagement = dNorm * 0.62 + lNorm * 0.38;

  const floor = 0.78;
  return floor + (1 - floor) * engagement;
}

export function getPerformanceScore(candidate: CandidateModel, system: SystemProfile): number {
  const ramBudget = system.freeRamGb ?? system.ramGb;
  const vramBudget = system.gpuVramGb ?? system.unifiedMemoryGb ?? 0;
  const ramHeadroom = Math.max(0, ramBudget - candidate.memoryProfile.recommendedRamGb);
  const vramHeadroom = candidate.memoryProfile.recommendedVramGb
    ? Math.max(0, vramBudget - candidate.memoryProfile.recommendedVramGb)
    : 2;

  let runtimeBonus = 0.15;
  if (candidate.runtime.includes("ollama") && system.runtimes.ollamaInstalled) {
    runtimeBonus += 0.1;
  }
  if (candidate.runtime.includes("llamacpp") && system.runtimes.llamaCppInstalled) {
    runtimeBonus += 0.1;
  }
  if (candidate.runtime.includes("transformers") && system.runtimes.pythonInstalled) {
    runtimeBonus += 0.05;
  }

  const speedComponent = candidate.speedTier / 5;
  const memoryComponent = Math.min(1, (ramHeadroom + 2) / Math.max(candidate.memoryProfile.recommendedRamGb, 1));
  const vramComponent = candidate.memoryProfile.recommendedVramGb ? Math.min(1, (vramHeadroom + 1) / 6) : 0.2;

  const raw = Math.max(0, Math.min(1, speedComponent * 0.45 + memoryComponent * 0.35 + vramComponent * 0.05 + runtimeBonus));
  return Math.max(
    0,
    Math.min(
      1,
      raw *
        practicalRamHeadroomFactor(candidate, system) *
        discoveryConfidenceMultiplier(candidate) *
        getCommunityReachMultiplier(candidate),
    ),
  );
}
