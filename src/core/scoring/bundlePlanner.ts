import type {
  CandidateCollections,
  CandidateModel,
  RecommendedBundle,
  SystemProfile,
  UserIntent,
} from "../shared/types.js";
import { isCandidateEligible } from "./eligibility.js";
import { chooseBundleLoadStrategy, estimatePeakRam, estimatePeakVram } from "./loadStrategy.js";
import { getPerformanceScore } from "./performance.js";
import { getPreferenceMultiplier } from "./preferences.js";
import { getQualityScore } from "./quality.js";

export type BundleScorecard = {
  bundle: RecommendedBundle;
  overall: number;
  speed: number;
  quality: number;
  local: number;
};

type ScoredCandidate = {
  candidate: CandidateModel;
  performance: number;
  quality: number;
  preference: number;
  overall: number;
};

function rankCandidates(candidates: CandidateModel[], system: SystemProfile, intent: UserIntent): ScoredCandidate[] {
  return candidates
    .filter((candidate) => isCandidateEligible(candidate, system, intent))
    .map((candidate) => {
      const performance = getPerformanceScore(candidate, system);
      const quality = getQualityScore(candidate, intent);
      const preference = getPreferenceMultiplier(candidate, intent);
      return {
        candidate,
        performance,
        quality,
        preference,
        overall: (performance * 0.45 + quality * 0.55) * preference,
      };
    })
    .sort((a, b) => b.overall - a.overall || a.candidate.id.localeCompare(b.candidate.id));
}

function pickTop(
  scored: ScoredCandidate[],
  count: number,
  fallback: CandidateModel[],
  system: SystemProfile,
  intent: UserIntent,
): CandidateModel[] {
  const selected = scored.slice(0, count).map((item) => item.candidate);
  if (selected.length > 0) {
    return selected;
  }
  return fallback
    .filter((candidate) => !candidate.gated)
    .filter((candidate) => isCandidateEligible(candidate, system, intent))
    .sort((a, b) => a.memoryProfile.minRamGb - b.memoryProfile.minRamGb || a.id.localeCompare(b.id))
    .slice(0, count);
}

export function collectNoFitExplanations(
  collections: CandidateCollections,
  system: SystemProfile,
  intent: UserIntent,
): string[] {
  const lines: string[] = [];

  const textOk = collections.text.some((c) => isCandidateEligible(c, system, intent));
  if (!textOk) {
    if (collections.text.length === 0) {
      lines.push("No text candidates were loaded; check your cache and connectivity.");
    } else {
      lines.push(
        "No text model met your RAM, VRAM, local-only, and task constraints. Try relaxing local preference, reducing workload scope, or using hardware with more memory.",
      );
    }
  }

  if (intent.requiresEmbeddings) {
    const embOk = collections.embedding.some((c) => isCandidateEligible(c, system, intent));
    if (!embOk && collections.embedding.length > 0) {
      lines.push(
        "Embeddings are required for your workflow, but no embedding model fit your constraints (memory, local preference, or gating).",
      );
    }
  }

  if (intent.requiresVision) {
    const visOk = collections.vision.some((c) => isCandidateEligible(c, system, intent));
    if (!visOk && collections.vision.length > 0) {
      lines.push(
        "Vision is required for your inputs, but no vision model fit your constraints (memory, VRAM, local preference, or gating).",
      );
    }
  }

  if (intent.requiresImageGeneration) {
    const imgOk = collections.image.some((c) => isCandidateEligible(c, system, intent));
    if (!imgOk && collections.image.length > 0) {
      lines.push(
        "Image generation is selected, but no image model fit your constraints (memory, VRAM, local preference, or gating).",
      );
    }
  }

  return lines;
}

function buildWarnings(parts: {
  textModel?: CandidateModel;
  embeddingModel?: CandidateModel;
  visionModel?: CandidateModel;
  imageModel?: CandidateModel;
}, system: SystemProfile, intent: UserIntent, estimatedPeakRamGb: number): string[] {
  const warnings: string[] = [];
  if (intent.requiresEmbeddings && parts.embeddingModel) {
    warnings.push("Switching embedding models later requires re-indexing your documents.");
  }
  if (intent.requiresVision && !parts.visionModel) {
    warnings.push("Scanned PDFs and screenshot analysis will be limited without a vision model.");
  }
  if (intent.requiresImageGeneration && (!system.gpuVramGb || system.gpuVramGb < 8)) {
    warnings.push("Image generation may feel slow without a stronger GPU or larger unified memory budget.");
  }
  if (estimatedPeakRamGb > (system.freeRamGb ?? system.ramGb)) {
    warnings.push("This stack is close to your current RAM budget, so on-demand loading is recommended.");
  }
  if (system.confidence !== "high") {
    warnings.push("Hardware detection confidence is not high, so the stack fit is conservative.");
  }
  return warnings;
}

function buildReasons(parts: {
  textModel?: CandidateModel;
  embeddingModel?: CandidateModel;
  visionModel?: CandidateModel;
  imageModel?: CandidateModel;
}, intent: UserIntent, loadStrategy: RecommendedBundle["loadStrategy"], speed: number, quality: number): string[] {
  const reasons = [
    `${parts.textModel?.id ?? "Primary model"} anchors the stack for ${intent.primaryUseCases.join(", ").replaceAll("_", " ")} workloads.`,
    `Load strategy ${loadStrategy} is estimated to keep the total stack within a realistic local budget based on detected hardware and current heuristics.`,
  ];
  if (parts.embeddingModel) {
    reasons.push(`${parts.embeddingModel.id} keeps document retrieval on a single consistent embedding space.`);
  }
  if (parts.visionModel) {
    reasons.push(`${parts.visionModel.id} covers screenshots, photos, and scanned documents.`);
  }
  if (parts.imageModel) {
    reasons.push(`${parts.imageModel.id} adds image generation without dominating the full bundle score.`);
  }
  reasons.push(speed >= quality ? "This stack leans faster than average for its capability set." : "This stack leans toward better output quality over raw speed.");
  return reasons;
}

function buildNextSteps(parts: {
  textModel?: CandidateModel;
  embeddingModel?: CandidateModel;
  visionModel?: CandidateModel;
  imageModel?: CandidateModel;
}): string[] {
  const steps = ["Install or confirm the runtime needed for the selected text model."];
  if (parts.embeddingModel) {
    steps.push("Create one document index with the recommended embedding model and keep it fixed.");
  }
  if (parts.visionModel) {
    steps.push("Load the vision model on demand for screenshots and scanned PDFs.");
  }
  if (parts.imageModel) {
    steps.push("Expect image generation to consume the largest burst of memory in this stack.");
  }
  return steps;
}

function deriveFitState(
  system: SystemProfile,
  loadStrategy: RecommendedBundle["loadStrategy"],
  fitConfidence: RecommendedBundle["fitConfidence"],
  estimatedPeakRamGb: number,
): RecommendedBundle["fitState"] {
  if (loadStrategy === "degraded_local") {
    return "degraded";
  }
  const free = Math.max(system.freeRamGb ?? system.ramGb, 1);
  if (fitConfidence === "low") {
    return "degraded";
  }
  if (estimatedPeakRamGb > free) {
    return "tight";
  }
  const ratio = estimatedPeakRamGb / Math.max(system.ramGb, 1);
  if (ratio > 0.85) {
    return "tight";
  }
  return fitConfidence === "high" ? "comfortable" : "tight";
}

function buildWhyHeldBack(system: SystemProfile, estimatedPeakRamGb: number): string[] {
  const lines: string[] = [];
  const free = Math.max(system.freeRamGb ?? system.ramGb, 1);
  if (estimatedPeakRamGb > free) {
    lines.push("Some larger models were excluded because their estimated peak RAM exceeds your current free memory.");
  } else if (estimatedPeakRamGb > free * 0.85) {
    lines.push("Models that would leave little RAM headroom were de-prioritized in favor of safer fits.");
  }
  if (system.confidence !== "high") {
    lines.push("Hardware detection was not fully certain, so conservative model choices were favored.");
  }
  return lines;
}

function downgradeConfidence(confidence: "low" | "medium" | "high"): "low" | "medium" | "high" {
  if (confidence === "high") {
    return "medium";
  }

  if (confidence === "medium") {
    return "low";
  }

  return "low";
}

function getFitConfidence(
  system: SystemProfile,
  loadStrategy: RecommendedBundle["loadStrategy"],
  estimatedPeakRamGb: number,
  estimatedPeakVramGb?: number,
): "low" | "medium" | "high" {
  const totalRamGb = Math.max(system.ramGb, 1);
  const freeRamGb = Math.max(system.freeRamGb ?? totalRamGb * 0.8, 1);
  const ramRatio = estimatedPeakRamGb / totalRamGb;
  const freeRamRatio = estimatedPeakRamGb / freeRamGb;

  const totalVramGb = system.gpuVramGb ?? system.unifiedMemoryGb;
  const vramRatio = estimatedPeakVramGb && totalVramGb ? estimatedPeakVramGb / Math.max(totalVramGb, 1) : 0;

  if (ramRatio > 1 || vramRatio > 1) {
    return "low";
  }

  const highRamThreshold = loadStrategy === "always_loaded" ? 0.72 : 0.88;
  const mediumRamThreshold = loadStrategy === "always_loaded" ? 0.9 : 1.0;

  let confidence: "low" | "medium" | "high";
  if (ramRatio <= highRamThreshold && vramRatio <= 0.75) {
    confidence = "high";
  } else if (ramRatio <= mediumRamThreshold && vramRatio <= 0.95) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  if (freeRamRatio > 1.15) {
    confidence = downgradeConfidence(confidence);
  } else if (freeRamRatio > 0.95 && confidence === "high") {
    confidence = "medium";
  }

  if (system.confidence === "medium") {
    confidence = downgradeConfidence(confidence);
  } else if (system.confidence === "low") {
    confidence = "low";
  }

  return confidence;
}

export function buildBundleScorecards(
  collections: CandidateCollections,
  system: SystemProfile,
  intent: UserIntent,
): BundleScorecard[] {
  const rankedText = rankCandidates(collections.text, system, intent);
  const rankedEmbedding = rankCandidates(collections.embedding, system, intent);
  const rankedVision = rankCandidates(collections.vision, system, intent);
  const rankedImage = rankCandidates(collections.image, system, intent);

  const textCandidates = pickTop(rankedText, 3, collections.text, system, intent);
  const embeddingCandidates = intent.requiresEmbeddings ? pickTop(rankedEmbedding, 2, collections.embedding, system, intent) : [undefined];
  const visionCandidates = intent.requiresVision ? pickTop(rankedVision, 2, collections.vision, system, intent) : [undefined];
  const imageCandidates = intent.requiresImageGeneration ? pickTop(rankedImage, 2, collections.image, system, intent) : [undefined];

  const scorecards: BundleScorecard[] = [];

  for (const textModel of textCandidates) {
    for (const embeddingModel of embeddingCandidates) {
      for (const visionModel of visionCandidates) {
        for (const imageModel of imageCandidates) {
          const loadStrategy = chooseBundleLoadStrategy(system, {
            textModel,
            embeddingModel,
            visionModel,
            imageModel,
          });
          const estimatedPeakRamGb = estimatePeakRam({ textModel, embeddingModel, visionModel, imageModel }, loadStrategy);
          const estimatedPeakVramGb = estimatePeakVram({ textModel, embeddingModel, visionModel, imageModel }, loadStrategy);

          const bundleSpeed =
            (textModel ? getPerformanceScore(textModel, system) : 0) * 0.55 +
            (embeddingModel ? getPerformanceScore(embeddingModel, system) : 0.1) * 0.1 +
            (visionModel ? getPerformanceScore(visionModel, system) : 0.05) * 0.2 +
            (imageModel ? getPerformanceScore(imageModel, system) : 0.05) * 0.15;

          const bundleQuality =
            (textModel ? getQualityScore(textModel, intent) : 0) * 0.55 +
            (embeddingModel ? getQualityScore(embeddingModel, intent) : 0.1) * 0.15 +
            (visionModel ? getQualityScore(visionModel, intent) : 0.1) * 0.15 +
            (imageModel ? getQualityScore(imageModel, intent) : 0.1) * 0.15;

          const localScore = [textModel, embeddingModel, visionModel, imageModel].filter(Boolean).every((item) => item?.localFriendly)
            ? 1
            : 0.55;
          const preferenceMultiplier = textModel ? getPreferenceMultiplier(textModel, intent) : 1;
          const memoryPenalty = estimatedPeakRamGb > (system.freeRamGb ?? system.ramGb) ? 0.2 : 0;
          const overall = Math.max(0, (bundleSpeed * 0.4 + bundleQuality * 0.45 + localScore * 0.15) * preferenceMultiplier - memoryPenalty);
          const fitConfidence = getFitConfidence(system, loadStrategy, estimatedPeakRamGb, estimatedPeakVramGb);
          const fitState = deriveFitState(system, loadStrategy, fitConfidence, estimatedPeakRamGb);
          const whyHeldBack = buildWhyHeldBack(system, estimatedPeakRamGb);

          const warnings = buildWarnings(
            { textModel, embeddingModel, visionModel, imageModel },
            system,
            intent,
            estimatedPeakRamGb,
          );
          const reasons = buildReasons(
            { textModel, embeddingModel, visionModel, imageModel },
            intent,
            loadStrategy,
            bundleSpeed,
            bundleQuality,
          );

          scorecards.push({
            bundle: {
              label: "best_overall",
              textModel,
              embeddingModel,
              visionModel,
              imageModel,
              loadStrategy,
              score: Number(overall.toFixed(3)),
              reasons,
              warnings,
              estimatedPeakRamGb,
              estimatedPeakVramGb,
              fitConfidence,
              fitState,
              memoryEstimateSource: "heuristic",
              whyHeldBack,
              nextSteps: buildNextSteps({ textModel, embeddingModel, visionModel, imageModel }),
            },
            overall,
            speed: bundleSpeed,
            quality: bundleQuality,
            local: localScore,
          });
        }
      }
    }
  }

  return scorecards.sort((a, b) => b.overall - a.overall || (b.speed - a.speed) || a.bundle.textModel?.id.localeCompare(b.bundle.textModel?.id ?? "") || 0);
}
