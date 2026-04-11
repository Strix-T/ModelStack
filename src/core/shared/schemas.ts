import { z } from "zod";

import { HARDWARE_BANDS, RECOMMENDATION_LABELS, SUPPORTED_GPU_BACKENDS, SUPPORTED_OSES, SUPPORTED_RUNTIMES } from "./constants.js";

export const runtimeSchema = z.enum(SUPPORTED_RUNTIMES);
export const osSchema = z.enum(SUPPORTED_OSES);
export const hardwareBandSchema = z.enum(HARDWARE_BANDS);
export const gpuBackendSchema = z.enum(SUPPORTED_GPU_BACKENDS);

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
  }),
});

export const userIntentSchema = z.object({
  primaryUseCases: z.array(
    z.enum([
      "general_chat",
      "writing",
      "coding",
      "documents",
      "vision_understanding",
      "image_generation",
    ]),
  ),
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
});

export const candidateModelSchema = z.object({
  id: z.string(),
  kind: z.enum(["text", "embedding", "vision", "image"]),
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
});

export const loadStrategySchema = z.enum([
  "always_loaded",
  "on_demand_secondary",
  "lightweight_all_local",
  "degraded_local",
]);

export const bundleFitStateSchema = z.enum(["comfortable", "tight", "degraded", "not_recommended"]);

export const memoryEstimateSourceSchema = z.enum(["heuristic", "explicit_metadata"]);

export const recommendedBundleSchema = z.object({
  label: z.enum(RECOMMENDATION_LABELS),
  textModel: candidateModelSchema.optional(),
  embeddingModel: candidateModelSchema.optional(),
  visionModel: candidateModelSchema.optional(),
  imageModel: candidateModelSchema.optional(),
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
});

export const candidateCollectionsSchema = z.object({
  text: z.array(candidateModelSchema),
  embedding: z.array(candidateModelSchema),
  vision: z.array(candidateModelSchema),
  image: z.array(candidateModelSchema),
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
