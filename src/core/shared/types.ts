import type {
  cacheSnapshotSchema,
  candidateCollectionsSchema,
  candidateModelSchema,
  candidateVariantSchema,
  engineSchema,
  gpuBackendSchema,
  hardwareBandSchema,
  loadStrategySchema,
  memoryEstimateBreakdownSchema,
  recommendationResultSchema,
  recommendedBundleSchema,
  runtimeSchema,
  systemProfileSchema,
  userIntentSchema,
} from "./schemas.js";

export type EngineId = import("zod").infer<typeof engineSchema>;
export type CandidateVariant = import("zod").infer<typeof candidateVariantSchema>;
export type MemoryEstimateBreakdown = import("zod").infer<typeof memoryEstimateBreakdownSchema>;
export type Runtime = import("zod").infer<typeof runtimeSchema>;
export type HardwareBand = import("zod").infer<typeof hardwareBandSchema>;
export type GpuBackend = import("zod").infer<typeof gpuBackendSchema>;
export type SystemProfile = import("zod").infer<typeof systemProfileSchema>;
export type UserIntent = import("zod").infer<typeof userIntentSchema>;
export type CandidateModel = import("zod").infer<typeof candidateModelSchema>;
export type CandidateCollections = import("zod").infer<typeof candidateCollectionsSchema>;
export type LoadStrategy = import("zod").infer<typeof loadStrategySchema>;
export type RecommendedBundle = import("zod").infer<typeof recommendedBundleSchema>;
export type CacheSnapshot = import("zod").infer<typeof cacheSnapshotSchema>;
export type RecommendationResult = import("zod").infer<typeof recommendationResultSchema>;
