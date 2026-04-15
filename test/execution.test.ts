import { describe, expect, it, vi } from "vitest";

import midMacSystem from "./fixtures/system-mid-mac.json" with { type: "json" };
import { getSeedCandidateCollections } from "../src/core/models/candidateRegistry.js";
import { rankRecommendedBundles } from "../src/core/scoring/finalRank.js";
import { recommendationResultSchema, systemProfileSchema } from "../src/core/shared/schemas.js";
import { resolveBundleStartIndex } from "../src/execution/applyStack.js";
import { pullOllamaModelsForBundle } from "../src/execution/downloadModels.js";
import {
  collectOllamaPullTags,
  extractOllamaTagsFromText,
  primaryOllamaRunTag,
} from "../src/execution/ollamaTargets.js";
import { parseRecommendationResultJson } from "../src/execution/parseRecommendation.js";
import { validateBundleAgainstSystem } from "../src/execution/validateAgainstSystem.js";
import { minimalIntent } from "./helpers/minimalIntent.js";

const midSystem = systemProfileSchema.parse(midMacSystem);

describe("parseRecommendationResultJson", () => {
  it("rejects invalid JSON", () => {
    const r = parseRecommendationResultJson("{");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("JSON");
    }
  });

  it("accepts a real recommendation export", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, minimalIntent());
    const raw = JSON.stringify(result);
    const r = parseRecommendationResultJson(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const again = recommendationResultSchema.safeParse(JSON.parse(raw));
      expect(again.success).toBe(true);
    }
  });
});

describe("ollamaTargets", () => {
  it("extracts tags from deploy hints", () => {
    expect(extractOllamaTagsFromText("run ollama pull qwen2.5:7b")).toEqual(["qwen2.5:7b"]);
    expect(extractOllamaTagsFromText("OLLAMA PULL gemma2:2b")).toEqual(["gemma2:2b"]);
  });

  it("collects pulls from a ranked Ollama bundle when hints exist", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, minimalIntent());
    const bundle = result.bundles[0];
    expect(bundle).toBeDefined();
    const tags = collectOllamaPullTags(bundle!);
    if (bundle!.recommendedEngine === "ollama" && bundle!.selectedTextVariant?.deployHint?.includes("ollama pull")) {
      expect(tags.length).toBeGreaterThan(0);
      expect(primaryOllamaRunTag(bundle!)).toBeDefined();
    }
  });
});

describe("validateBundleAgainstSystem", () => {
  it("fails when peak RAM exceeds available budget", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, minimalIntent());
    const bundle = result.bundles[0];
    expect(bundle).toBeDefined();
    const tightSystem = { ...midSystem, ramGb: 4, freeRamGb: 2 };
    const v = validateBundleAgainstSystem(
      { ...bundle!, estimatedPeakRamGb: 80 },
      tightSystem,
    );
    expect(v.ok).toBe(false);
  });

  it("passes for a normal mid-tier bundle on mid Mac fixture", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, minimalIntent());
    const bundle = result.bundles[0];
    expect(bundle).toBeDefined();
    const v = validateBundleAgainstSystem(bundle!, midSystem);
    expect(v.ok).toBe(true);
  });
});

describe("resolveBundleStartIndex", () => {
  it("defaults to first bundle", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, minimalIntent());
    expect(resolveBundleStartIndex(result.bundles)).toBe(0);
  });
});

describe("pullOllamaModelsForBundle", () => {
  it("invokes ollama pull for each tag with mocked execa", async () => {
    const execaImpl = vi.fn().mockResolvedValue({ exitCode: 0 });
    const bundle = {
      label: "best_overall" as const,
      loadStrategy: "always_loaded" as const,
      score: 1,
      reasons: [],
      warnings: [],
      estimatedPeakRamGb: 8,
      fitConfidence: "high" as const,
      nextSteps: [],
      recommendedEngine: "ollama" as const,
      fallbackEngine: "llamacpp" as const,
      engineReasons: [],
      selectedTextVariant: {
        variantId: "t",
        baseModelId: "x",
        format: "gguf" as const,
        precision: "q4" as const,
        engineCompatibility: ["ollama"] as ("ollama")[],
        estimatedRamGb: 4,
        contextClass: "standard" as const,
        speedModifier: 1,
        qualityModifier: 1,
        localFriendly: true,
        deployHint: "ollama pull test:tag",
      },
    };
    const r = await pullOllamaModelsForBundle(bundle, { execaImpl: execaImpl as typeof import("execa").execa });
    expect(r.ok).toBe(true);
    if (r.ok === true) {
      expect(r.pulledTags).toContain("test:tag");
    }
    expect(execaImpl).toHaveBeenCalledWith("ollama", ["pull", "test:tag"], expect.any(Object));
  });
});
