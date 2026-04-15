import { inferStackArchetype } from "../archetypes/archetypes.js";
import { candidateSupportsEngine, formatMatchesEngine } from "../engines/engineCompatibility.js";
import { getEngineDefinition } from "../engines/engineRegistry.js";
import type { EngineSelection } from "../engines/engineSelector.js";
import { selectConcreteEnginePairForCandidate, selectEngine } from "../engines/engineSelector.js";
import { buildInstallSteps } from "../output/installSteps.js";
import type {
  CandidateCollections,
  CandidateModel,
  EngineId,
  MemoryEstimateBreakdown,
  RecommendedBundle,
  SystemProfile,
  UserIntent,
} from "../shared/types.js";
import { explainBundleScore } from "./explainScore.js";
import { isCandidateEligible } from "./eligibility.js";
import { chooseBundleLoadStrategy, estimatePeakRam, estimatePeakVram, type BundleRamParts } from "./loadStrategy.js";
import { getPerformanceScore } from "./performance.js";
import { getPreferenceMultiplier } from "./preferences.js";
import { getQualityScore } from "./quality.js";
import { getBundleScoringWeights } from "./scoringProfiles.js";
import { selectVariantForModel } from "./variantSelector.js";

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

function overheadForEngine(engine: EngineId): number {
  switch (engine) {
    case "ollama":
      return 0.7;
    case "llamacpp":
      return 0.55;
    case "lm_studio":
      return 0.85;
    case "transformers":
      return 1.6;
    case "vllm":
      return 2.3;
    case "mlx":
      return 1.05;
    default:
      return 1.1;
  }
}

function kvCacheHeuristicGb(intent: UserIntent): number {
  switch (intent.contextPreference) {
    case "long_context":
      return 2.6;
    case "standard":
      return 1.2;
    default:
      return 1.5;
  }
}

function buildMemoryBreakdown(
  engine: EngineId,
  intent: UserIntent,
  textRamGb: number,
  parts: BundleRamParts,
  loadStrategy: RecommendedBundle["loadStrategy"],
): MemoryEstimateBreakdown {
  const secondaryModelsRamGb =
    adjustedRam(parts.embeddingModel, loadStrategy) +
    adjustedRam(parts.visionModel, loadStrategy) +
    adjustedRam(parts.imageModel, loadStrategy) +
    adjustedRam(parts.rerankerModel, loadStrategy) +
    adjustedRam(parts.speechToTextModel, loadStrategy) +
    adjustedRam(parts.textToSpeechModel, loadStrategy);

  const baseModelRamGb = textRamGb;
  const engineOverheadGb = overheadForEngine(engine);
  const kvCacheRamGb = kvCacheHeuristicGb(intent);

  return {
    baseModelRamGb,
    engineOverheadGb,
    kvCacheRamGb,
    secondaryModelsRamGb,
    totalEstimatedPeakRamGb: estimatePeakRam(parts, loadStrategy),
    totalEstimatedPeakVramGb: estimatePeakVram(parts, loadStrategy),
    source: parts.textRamGbOverride !== undefined ? "variant_heuristic" : "heuristic",
  };
}

function adjustedRam(model: CandidateModel | undefined, loadStrategy: RecommendedBundle["loadStrategy"]): number {
  if (!model) {
    return 0;
  }
  const useRec = loadStrategy === "always_loaded" || loadStrategy === "on_demand_secondary";
  const base = useRec ? model.memoryProfile.recommendedRamGb : model.memoryProfile.minRamGb;
  return base * (model.formats.includes("gguf") ? 0.88 : 1);
}

function simplicityMultiplier(engine: EngineId, intent: UserIntent): number {
  const diff = getEngineDefinition(engine).installDifficulty;
  if (intent.installComfort === "simple" && diff !== "simple") {
    return 0.9;
  }
  if (intent.installComfort === "moderate" && diff === "advanced") {
    return 0.94;
  }
  return 1;
}

function resolveTextPoolAndEngine(
  collections: CandidateCollections,
  system: SystemProfile,
  intent: UserIntent,
): { selection: EngineSelection; textPool: CandidateModel[] } {
  let selection = selectEngine(system, intent);
  const tryEngine = (engine: EngineId) =>
    collections.text.filter(
      (c) =>
        isCandidateEligible(c, system, intent) &&
        candidateSupportsEngine(c, engine) &&
        formatMatchesEngine(engine, c.formats, intent.formatPreference),
    );

  let pool = tryEngine(selection.primary);
  if (pool.length === 0) {
    pool = tryEngine(selection.fallback);
    if (pool.length > 0) {
      selection = {
        ...selection,
        primary: selection.fallback,
        reasons: [...selection.reasons, `Primary engine switched to ${getEngineDefinition(selection.fallback).label} for model compatibility.`],
      };
    }
  }
  if (pool.length === 0) {
    const order: EngineId[] = ["ollama", "transformers", "llamacpp", "other"];
    for (const e of order) {
      pool = tryEngine(e);
      if (pool.length > 0) {
        selection = {
          primary: e,
          fallback: selection.primary,
          reasons: [`Using ${getEngineDefinition(e).label} so at least one text model matches runtimes and format preference.`],
          warnings: selection.warnings,
        };
        break;
      }
    }
  }
  if (pool.length === 0) {
    pool = collections.text.filter((c) => isCandidateEligible(c, system, intent));
    selection = {
      primary: "other",
      fallback: "transformers",
      reasons: ["No engine-specific filter matched; showing best-effort text models."],
      warnings: [...selection.warnings, "Verify engine and format compatibility manually."],
    };
  }

  if (pool.length > 0 && selection.primary === "other") {
    const anchor = [...pool].sort(
      (a, b) => b.qualityTier - a.qualityTier || a.memoryProfile.minRamGb - b.memoryProfile.minRamGb,
    )[0]!;
    const refined = selectConcreteEnginePairForCandidate(anchor, system, intent);
    if (refined.primary !== "other") {
      selection = {
        ...selection,
        primary: refined.primary,
        fallback: refined.fallback,
        reasons: [
          ...selection.reasons,
          `Suggested runtime: ${getEngineDefinition(refined.primary).label} for ${anchor.id} (matches its on-disk format).`,
        ],
      };
    }
  }

  return { selection, textPool: pool };
}

function rankCandidates(
  candidates: CandidateModel[],
  system: SystemProfile,
  intent: UserIntent,
  engine: EngineId,
): ScoredCandidate[] {
  return candidates
    .filter((candidate) => isCandidateEligible(candidate, system, intent))
    .map((candidate) => {
      const performance = getPerformanceScore(candidate, system, { engine });
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
  engine: EngineId,
): CandidateModel[] {
  const selected = scored.slice(0, count).map((item) => item.candidate);
  if (selected.length > 0) {
    return selected;
  }
  return fallback
    .filter((candidate) => !candidate.gated)
    .filter((candidate) => isCandidateEligible(candidate, system, intent))
    .filter((candidate) => candidateSupportsEngine(candidate, engine))
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

  if (intent.requiresReranker && collections.reranker.length > 0) {
    const ok = collections.reranker.some((c) => isCandidateEligible(c, system, intent));
    if (!ok) {
      lines.push("Reranking was requested, but no reranker model fit your current constraints.");
    }
  }

  if (intent.requiresSpeechToText && collections.speechToText.length > 0) {
    const ok = collections.speechToText.some((c) => isCandidateEligible(c, system, intent));
    if (!ok) {
      lines.push("Speech-to-text was requested, but no speech model fit your current constraints.");
    }
  }

  if (intent.requiresSpeechSynthesis && collections.textToSpeech.length > 0) {
    const ok = collections.textToSpeech.some((c) => isCandidateEligible(c, system, intent));
    if (!ok) {
      lines.push("Text-to-speech was requested, but no TTS model fit your current constraints.");
    }
  }

  return lines;
}

function buildWarnings(
  parts: BundleRamParts,
  system: SystemProfile,
  intent: UserIntent,
  estimatedPeakRamGb: number,
  engineWarnings: string[],
): string[] {
  const warnings: string[] = [...engineWarnings];
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

function buildReasons(
  parts: BundleRamParts,
  intent: UserIntent,
  loadStrategy: RecommendedBundle["loadStrategy"],
  speed: number,
  quality: number,
  engineReasons: string[],
): string[] {
  const reasons = [
    ...engineReasons,
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
  if (parts.rerankerModel) {
    reasons.push(`${parts.rerankerModel.id} refines retrieved chunks for higher precision RAG.`);
  }
  reasons.push(speed >= quality ? "This stack leans faster than average for its capability set." : "This stack leans toward better output quality over raw speed.");
  return reasons;
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
  const { selection: enginePick, textPool } = resolveTextPoolAndEngine(collections, system, intent);
  const engine = enginePick.primary;

  const rankedText = rankCandidates(textPool, system, intent, engine);
  const rankedEmbedding = rankCandidates(collections.embedding, system, intent, engine);
  const rankedVision = rankCandidates(collections.vision, system, intent, engine);
  const rankedImage = rankCandidates(collections.image, system, intent, engine);
  const rankedReranker = rankCandidates(collections.reranker ?? [], system, intent, engine);
  const rankedStt = rankCandidates(collections.speechToText ?? [], system, intent, engine);
  const rankedTts = rankCandidates(collections.textToSpeech ?? [], system, intent, engine);

  const textCandidates = pickTop(rankedText, 3, collections.text, system, intent, engine);
  const embeddingCandidates = intent.requiresEmbeddings
    ? pickTop(rankedEmbedding, 2, collections.embedding, system, intent, engine)
    : [undefined];
  const visionCandidates = intent.requiresVision ? pickTop(rankedVision, 2, collections.vision, system, intent, engine) : [undefined];
  const imageCandidates = intent.requiresImageGeneration
    ? pickTop(rankedImage, 2, collections.image, system, intent, engine)
    : [undefined];
  const rerankerCandidates = intent.requiresReranker ? pickTop(rankedReranker, 1, collections.reranker ?? [], system, intent, engine) : [undefined];
  const sttCandidates = intent.requiresSpeechToText ? pickTop(rankedStt, 1, collections.speechToText ?? [], system, intent, engine) : [undefined];
  const ttsCandidates = intent.requiresSpeechSynthesis ? pickTop(rankedTts, 1, collections.textToSpeech ?? [], system, intent, engine) : [undefined];

  const scorecards: BundleScorecard[] = [];
  const weights = getBundleScoringWeights(intent);

  for (const textModel of textCandidates) {
    const variantPick = selectVariantForModel(textModel, engine, intent, system);
    const textRamGbOverride = variantPick.variant?.estimatedRamGb;

    for (const embeddingModel of embeddingCandidates) {
      for (const visionModel of visionCandidates) {
        for (const imageModel of imageCandidates) {
          for (const rerankerModel of rerankerCandidates) {
            for (const speechToTextModel of sttCandidates) {
              for (const textToSpeechModel of ttsCandidates) {
                const ramParts: BundleRamParts = {
                  textModel,
                  embeddingModel,
                  visionModel,
                  imageModel,
                  rerankerModel,
                  speechToTextModel,
                  textToSpeechModel,
                  textRamGbOverride,
                };

                const loadStrategy = chooseBundleLoadStrategy(system, ramParts);
                const estimatedPeakRamGb = estimatePeakRam(ramParts, loadStrategy);
                const estimatedPeakVramGb = estimatePeakVram(ramParts, loadStrategy);

                const bundleSpeed =
                  (textModel ? getPerformanceScore(textModel, system, { engine }) : 0) * 0.45 +
                  (embeddingModel ? getPerformanceScore(embeddingModel, system, { engine }) : 0.08) * 0.12 +
                  (visionModel ? getPerformanceScore(visionModel, system, { engine }) : 0.04) * 0.15 +
                  (imageModel ? getPerformanceScore(imageModel, system, { engine }) : 0.04) * 0.14 +
                  (rerankerModel ? getPerformanceScore(rerankerModel, system, { engine }) : 0.03) * 0.08 +
                  (speechToTextModel ? getPerformanceScore(speechToTextModel, system, { engine }) : 0.02) * 0.03 +
                  (textToSpeechModel ? getPerformanceScore(textToSpeechModel, system, { engine }) : 0.02) * 0.03;

                const bundleQuality =
                  (textModel ? getQualityScore(textModel, intent) : 0) * 0.45 +
                  (embeddingModel ? getQualityScore(embeddingModel, intent) : 0.08) * 0.14 +
                  (visionModel ? getQualityScore(visionModel, intent) : 0.05) * 0.15 +
                  (imageModel ? getQualityScore(imageModel, intent) : 0.05) * 0.14 +
                  (rerankerModel ? getQualityScore(rerankerModel, intent) : 0.04) * 0.07 +
                  (speechToTextModel ? getQualityScore(speechToTextModel, intent) : 0.03) * 0.03 +
                  (textToSpeechModel ? getQualityScore(textToSpeechModel, intent) : 0.03) * 0.02;

                const localScore = [textModel, embeddingModel, visionModel, imageModel, rerankerModel, speechToTextModel, textToSpeechModel]
                  .filter(Boolean)
                  .every((item) => item?.localFriendly)
                  ? 1
                  : 0.55;
                const preferenceMultiplier = textModel ? getPreferenceMultiplier(textModel, intent) : 1;
                const memoryPenalty = estimatedPeakRamGb > (system.freeRamGb ?? system.ramGb) ? 0.2 : 0;
                const sim = simplicityMultiplier(engine, intent);
                const overall = Math.max(
                  0,
                  (bundleSpeed * weights.speed + bundleQuality * weights.quality + localScore * weights.local) * preferenceMultiplier * sim -
                    memoryPenalty +
                    weights.simplicity * sim * 0.05,
                );

                const fitConfidence = getFitConfidence(system, loadStrategy, estimatedPeakRamGb, estimatedPeakVramGb);
                const fitState = deriveFitState(system, loadStrategy, fitConfidence, estimatedPeakRamGb);
                const whyHeldBack = buildWhyHeldBack(system, estimatedPeakRamGb);

                const textGb = textRamGbOverride ?? textModel.memoryProfile.recommendedRamGb;
                const memoryBreakdown = buildMemoryBreakdown(engine, intent, textGb, ramParts, loadStrategy);

                const bundleBase: RecommendedBundle = {
                  label: "best_overall",
                  textModel,
                  embeddingModel,
                  visionModel,
                  imageModel,
                  rerankerModel,
                  speechToTextModel,
                  textToSpeechModel,
                  loadStrategy,
                  score: Number(overall.toFixed(3)),
                  reasons: [],
                  warnings: [],
                  estimatedPeakRamGb,
                  estimatedPeakVramGb,
                  fitConfidence,
                  fitState,
                  memoryEstimateSource: variantPick.variant ? "variant_heuristic" : "heuristic",
                  whyHeldBack,
                  nextSteps: [],
                  recommendedEngine: engine,
                  fallbackEngine: enginePick.fallback,
                  engineReasons: enginePick.reasons,
                  engineWarnings: enginePick.warnings.length > 0 ? enginePick.warnings : undefined,
                  selectedTextVariant: variantPick.variant,
                  variantReasons: variantPick.reasons,
                  skippedStrongerVariants: variantPick.skippedStronger.length > 0 ? variantPick.skippedStronger : undefined,
                  memoryBreakdown,
                  scoreExplanation: [],
                  stackArchetype: undefined,
                };

                bundleBase.reasons = buildReasons(ramParts, intent, loadStrategy, bundleSpeed, bundleQuality, enginePick.reasons);
                bundleBase.warnings = buildWarnings(ramParts, system, intent, estimatedPeakRamGb, enginePick.warnings);
                bundleBase.nextSteps = buildInstallSteps(engine, ramParts, variantPick.variant);
                bundleBase.stackArchetype = inferStackArchetype(intent, bundleBase);
                bundleBase.scoreExplanation = explainBundleScore(bundleBase, intent);

                scorecards.push({
                  bundle: bundleBase,
                  overall,
                  speed: bundleSpeed,
                  quality: bundleQuality,
                  local: localScore,
                });
              }
            }
          }
        }
      }
    }
  }

  return scorecards.sort(
    (a, b) =>
      b.overall - a.overall ||
      b.speed - a.speed ||
      a.bundle.textModel?.id.localeCompare(b.bundle.textModel?.id ?? "") ||
      0,
  );
}
