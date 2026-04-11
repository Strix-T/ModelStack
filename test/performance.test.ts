import { describe, expect, it } from "vitest";

import { getCommunityReachMultiplier, getPerformanceScore } from "../src/core/scoring/performance.js";
import type { CandidateModel, SystemProfile } from "../src/core/shared/types.js";

function baseCandidate(overrides: Partial<CandidateModel>): CandidateModel {
  return {
    id: "org/model",
    kind: "text",
    runtime: ["ollama"],
    tasks: ["text_generation"],
    localFriendly: true,
    speedTier: 4,
    qualityTier: 4,
    source: "discovered",
    gated: false,
    formats: ["gguf"],
    parameterClass: "medium",
    memoryProfile: { minRamGb: 8, recommendedRamGb: 12 },
    discoveryConfidence: "high",
    ...overrides,
  } as CandidateModel;
}

const midSystem: SystemProfile = {
  os: "macos",
  cpuModel: "M4",
  cpuCores: 10,
  ramGb: 24,
  freeRamGb: 16,
  hardwareBand: "medium",
  gpuBackend: "metal",
  unifiedMemoryGb: 24,
  detectionWarnings: [],
  confidence: "high",
  runtimes: { ollamaInstalled: true, llamaCppInstalled: false, pythonInstalled: true },
};

describe("getCommunityReachMultiplier", () => {
  it("does not penalize curated seeds", () => {
    expect(getCommunityReachMultiplier(baseCandidate({ source: "seed" }))).toBe(1);
  });

  it("penalizes discovered models with no engagement stats", () => {
    expect(getCommunityReachMultiplier(baseCandidate({ source: "discovered" }))).toBe(0.82);
  });

  it("approaches 1 for very popular download counts", () => {
    const m = getCommunityReachMultiplier(
      baseCandidate({ source: "discovered", hfDownloads: 800_000, hfLikes: 5000 }),
    );
    expect(m).toBeGreaterThan(0.96);
  });

  it("ranks a popular discovered model higher than an obscure one with same tiers", () => {
    const obscure = getPerformanceScore(
      baseCandidate({
        source: "discovered",
        hfDownloads: 5,
        hfLikes: 0,
      }),
      midSystem,
    );
    const popular = getPerformanceScore(
      baseCandidate({
        source: "discovered",
        hfDownloads: 200_000,
        hfLikes: 2000,
      }),
      midSystem,
    );
    expect(popular).toBeGreaterThan(obscure);
  });
});
