import { z } from "zod";

import {
  HARDWARE_BANDS,
  RECOMMENDATION_LABELS,
  SUPPORTED_ENGINES,
  SUPPORTED_GPU_BACKENDS,
  SUPPORTED_OSES,
  SUPPORTED_RUNTIMES,
  USER_PREFERRED_ENGINES,
} from "./constants.js";

export const runtimeSchema = z.enum(SUPPORTED_RUNTIMES);
export const engineSchema = z.enum(SUPPORTED_ENGINES);
export const preferredEngineSchema = z.enum(USER_PREFERRED_ENGINES);
export const osSchema = z.enum(SUPPORTED_OSES);
export const hardwareBandSchema = z.enum(HARDWARE_BANDS);
export const gpuBackendSchema = z.enum(SUPPORTED_GPU_BACKENDS);

export const precisionSchema = z.enum([
  "fp16",
  "bf16",
  "int8",
  "q8",
  "q6",
  "q5",
  "q4",
  "q3",
  "unknown",
]);

export const candidateVariantSchema = z.object({
  variantId: z.string(),
  baseModelId: z.string(),
  format: z.enum(["gguf", "safetensors", "onnx", "other"]),
  precision: precisionSchema,
  quantLabel: z.string().optional(),
  engineCompatibility: z.array(engineSchema).min(1),
  estimatedRamGb: z.number().nonnegative(),
  estimatedVramGb: z.number().nonnegative().optional(),
  contextClass: z.enum(["short", "standard", "long"]),
  speedModifier: z.number(),
  qualityModifier: z.number(),
  localFriendly: z.boolean(),
  /** Ollama tag, HF file hint, or short human note */
  deployHint: z.string().optional(),
});

export const memoryEstimateBreakdownSchema = z.object({
  baseModelRamGb: z.number().nonnegative(),
  engineOverheadGb: z.number().nonnegative(),
  kvCacheRamGb: z.number().nonnegative(),
  secondaryModelsRamGb: z.number().nonnegative(),
  totalEstimatedPeakRamGb: z.number().nonnegative(),
  totalEstimatedPeakVramGb: z.number().nonnegative().optional(),
  source: z.enum(["heuristic", "variant_heuristic", "explicit_metadata"]),
});

export const systemProfileSchema = z.object({
  os: osSchema,
  cpuModel: z.string(),
  cpuCores: z.number().int().positive(),
  ramGb: z.number().nonnegative(),
  freeRamGb: z.number().nonnegative().optional(),
  gpuVendor: z.string().optional(),
  gpuModel: z.string().optional(),
  gpuVramGb: z.number().nonnegative().optional(),
  unifiedMemoryGb: z.number().nonnegative().optional(),
  storageFreeGb: z.number().nonnegative().optional(),
  hardwareBand: hardwareBandSchema,
  gpuBackend: gpuBackendSchema.optional(),
  detectionWarnings: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  runtimes: z.object({
    ollamaInstalled: z.boolean(),
    llamaCppInstalled: z.boolean(),
    pythonInstalled: z.boolean(),
    lmStudioInstalled: z.boolean().optional(),
    dockerInstalled: z.boolean().optional(),
    mlxPythonInstalled: z.boolean().optional(),
  }),
});

export const primaryUseCaseSchema = z.enum([
  "general_chat",
  "writing",
  "coding",
  "documents",
  "vision_understanding",
  "image_generation",
  "scanned_documents",
  "screenshots",
  "photos",
  "speech_to_text",
  "text_to_speech",
  "agents",
  "reranking",
]);

export const userIntentSchema = z.object({
  primaryUseCases: z.array(primaryUseCaseSchema),
  inputTypes: z.array(
    z.enum([
      "text",
      "pdf_text",
      "pdf_scanned",
      "screenshots",
      "photos",
      "code",
    ]),
  ),
  priority: z.enum(["speed", "quality", "balanced"]),
  localPreference: z.enum(["local_only", "prefer_local", "no_preference"]),
  allowsSlowSmart: z.boolean(),
  requiresEmbeddings: z.boolean(),
  requiresVision: z.boolean(),
  requiresImageGeneration: z.boolean(),
  preferredEngine: preferredEngineSchema.default("auto"),
  installComfort: z.enum(["simple", "moderate", "advanced"]).default("moderate"),
  formatPreference: z.enum(["auto", "gguf", "safetensors", "onnx"]).default("auto"),
  contextPreference: z.enum(["standard", "long_context", "not_sure"]).default("not_sure"),
  quantizationTolerance: z.enum(["prefer_quality", "balanced", "prefer_efficiency"]).default("balanced"),
  requiresReranker: z.boolean().default(false),
  requiresOCR: z.boolean().default(false),
  requiresToolCalling: z.boolean().default(false),
  requiresLongContext: z.boolean().default(false),
  requiresSpeechToText: z.boolean().default(false),
  requiresSpeechSynthesis: z.boolean().default(false),
});

export const candidateModelSchema = z.object({
  id: z.string(),
  kind: z.enum(["text", "embedding", "vision", "image", "reranker", "speech_to_text", "text_to_speech"]),
  family: z.string().optional(),
  runtime: z.array(runtimeSchema).min(1),
  tasks: z.array(z.string()).min(1),
  localFriendly: z.boolean(),
  estimatedRamGb: z.number().nonnegative().optional(),
  estimatedVramGb: z.number().nonnegative().optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  speedTier: z.number().int().min(1).max(5),
  qualityTier: z.number().int().min(1).max(5),
  notes: z.array(z.string()).optional(),
  source: z.enum(["seed", "discovered", "enriched"]),
  license: z.string().optional(),
  gated: z.boolean(),
  formats: z.array(z.enum(["gguf", "safetensors", "onnx", "other"])),
  parameterClass: z.enum(["small", "medium", "large"]),
  memoryProfile: z.object({
    minRamGb: z.number().nonnegative(),
    recommendedRamGb: z.number().nonnegative(),
    minVramGb: z.number().nonnegative().optional(),
    recommendedVramGb: z.number().nonnegative().optional(),
  }),
  discoveryConfidence: z.enum(["low", "medium", "high"]),
  /** Hugging Face all-time downloads (when known from API). */
  hfDownloads: z.number().int().nonnegative().optional(),
  /** Hugging Face likes (when known from API). */
  hfLikes: z.number().int().nonnegative().optional(),
  variants: z.array(candidateVariantSchema).optional(),
  defaultVariantStrategy: z.enum(["speed", "balanced", "quality"]).optional(),
  contextWindow: z.number().int().positive().optional(),
  toolUseSupport: z.enum(["none", "weak", "strong"]).optional(),
  multilingualSupport: z.enum(["low", "medium", "high"]).optional(),
  ocrStrength: z.enum(["none", "weak", "strong"]).optional(),
  rerankFriendly: z.boolean().optional(),
});

export const loadStrategySchema = z.enum([
  "always_loaded",
  "on_demand_secondary",
  "lightweight_all_local",
  "degraded_local",
]);

export const bundleFitStateSchema = z.enum(["comfortable", "tight", "degraded", "not_recommended"]);

export const memoryEstimateSourceSchema = z.enum([
  "heuristic",
  "explicit_metadata",
  "variant_heuristic",
]);

export const recommendedBundleSchema = z.object({
  label: z.enum(RECOMMENDATION_LABELS),
  textModel: candidateModelSchema.optional(),
  embeddingModel: candidateModelSchema.optional(),
  visionModel: candidateModelSchema.optional(),
  imageModel: candidateModelSchema.optional(),
  rerankerModel: candidateModelSchema.optional(),
  speechToTextModel: candidateModelSchema.optional(),
  textToSpeechModel: candidateModelSchema.optional(),
  loadStrategy: loadStrategySchema,
  score: z.number(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  estimatedPeakRamGb: z.number().nonnegative(),
  estimatedPeakVramGb: z.number().nonnegative().optional(),
  fitConfidence: z.enum(["low", "medium", "high"]),
  nextSteps: z.array(z.string()),
  fitState: bundleFitStateSchema.optional(),
  memoryEstimateSource: memoryEstimateSourceSchema.optional(),
  whyHeldBack: z.array(z.string()).optional(),
  recommendedEngine: engineSchema,
  fallbackEngine: engineSchema,
  engineReasons: z.array(z.string()),
  engineWarnings: z.array(z.string()).optional(),
  selectedTextVariant: candidateVariantSchema.optional(),
  variantReasons: z.array(z.string()).optional(),
  skippedStrongerVariants: z.array(z.string()).optional(),
  memoryBreakdown: memoryEstimateBreakdownSchema.optional(),
  scoreExplanation: z.array(z.string()).optional(),
  stackArchetype: z.string().optional(),
});

export const candidateCollectionsSchema = z.object({
  text: z.array(candidateModelSchema),
  embedding: z.array(candidateModelSchema),
  vision: z.array(candidateModelSchema),
  image: z.array(candidateModelSchema),
  reranker: z.array(candidateModelSchema).default([]),
  speechToText: z.array(candidateModelSchema).default([]),
  textToSpeech: z.array(candidateModelSchema).default([]),
});

export const cacheSnapshotSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  seedCandidates: candidateCollectionsSchema,
  discoveredCandidates: candidateCollectionsSchema,
  enrichedCandidates: candidateCollectionsSchema,
  warnings: z.array(z.string()),
});

export const recommendationResultSchema = z.object({
  system: systemProfileSchema,
  intent: userIntentSchema,
  bundles: z.array(recommendedBundleSchema),
  generatedAt: z.string(),
  cacheWarnings: z.array(z.string()),
  noFitExplanations: z.array(z.string()).optional(),
});
