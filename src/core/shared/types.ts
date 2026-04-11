import type {
  cacheSnapshotSchema,
  candidateCollectionsSchema,
  candidateModelSchema,
  gpuBackendSchema,
  hardwareBandSchema,
  loadStrategySchema,
  recommendationResultSchema,
  recommendedBundleSchema,
  runtimeSchema,
  systemProfileSchema,
  userIntentSchema,
} from "./schemas.js";

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
