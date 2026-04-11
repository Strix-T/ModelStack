import { describe, expect, it } from "vitest";

import lowEndSystem from "./fixtures/system-low-end.json" with { type: "json" };
import midMacSystem from "./fixtures/system-mid-mac.json" with { type: "json" };
import strongCreatorSystem from "./fixtures/system-strong-creator.json" with { type: "json" };
import system16gbMac from "./fixtures/system-16gb-mac.json" with { type: "json" };
import { getSeedCandidateCollections } from "../src/core/models/candidateRegistry.js";
import { collectNoFitExplanations } from "../src/core/scoring/bundlePlanner.js";
import { rankRecommendedBundles } from "../src/core/scoring/finalRank.js";
import { systemProfileSchema } from "../src/core/shared/schemas.js";

const lowSystem = systemProfileSchema.parse(lowEndSystem);
const midSystem = systemProfileSchema.parse(midMacSystem);
const strongSystem = systemProfileSchema.parse(strongCreatorSystem);
const constrainedMidSystem = systemProfileSchema.parse({
  ...midMacSystem,
  freeRamGb: 13.8,
});
const mac16System = systemProfileSchema.parse(system16gbMac);

describe("bundle ranking", () => {
  it("returns text plus embedding for digital document workflows", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, {
      primaryUseCases: ["documents"],
      inputTypes: ["pdf_text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: false,
      requiresImageGeneration: false,
    });

    expect(result.bundles[0]?.embeddingModel?.kind).toBe("embedding");
    expect(result.bundles[0]?.visionModel).toBeUndefined();
  });

  it("requires a vision-capable bundle for scanned PDFs on capable systems", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), strongSystem, {
      primaryUseCases: ["documents", "vision_understanding"],
      inputTypes: ["pdf_scanned"],
      priority: "quality",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: true,
      requiresImageGeneration: false,
    });

    expect(result.bundles.some((bundle) => bundle.visionModel?.kind === "vision")).toBe(true);
  });

  it("warns about image generation on weaker systems", () => {
    const systemWithGpuHeadroom = systemProfileSchema.parse({
      ...lowEndSystem,
      unifiedMemoryGb: 16,
      gpuVramGb: undefined,
    });
    const result = rankRecommendedBundles(getSeedCandidateCollections(), systemWithGpuHeadroom, {
      primaryUseCases: ["general_chat", "image_generation"],
      inputTypes: ["text"],
      priority: "speed",
      localPreference: "local_only",
      allowsSlowSmart: false,
      requiresEmbeddings: false,
      requiresVision: false,
      requiresImageGeneration: true,
    });

    expect(result.bundles.length).toBeGreaterThan(0);
    expect(result.bundles[0]?.warnings.join(" ") ?? "").toContain("Image generation");
  });

  it("keeps the most local-friendly bundle on local models", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, {
      primaryUseCases: ["general_chat"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "local_only",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: false,
      requiresImageGeneration: false,
    });

    const localBundle = result.bundles.find((bundle) => bundle.label === "most_local_friendly");
    expect(localBundle?.textModel?.localFriendly).toBe(true);
    expect(localBundle?.embeddingModel?.kind).toBe("embedding");
  });

  it("does not mark a fitting text-only bundle as low confidence on a mid-tier machine", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), midSystem, {
      primaryUseCases: ["general_chat"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: false,
      requiresImageGeneration: false,
    });

    expect(result.bundles[0]?.fitConfidence).not.toBe("low");
  });

  it("recommends an embedding model for general chat plus vision workflows", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), strongSystem, {
      primaryUseCases: ["general_chat", "vision_understanding"],
      inputTypes: ["text", "screenshots"],
      priority: "quality",
      localPreference: "local_only",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: true,
      requiresImageGeneration: false,
    });

    expect(result.bundles.some((bundle) => bundle.embeddingModel?.kind === "embedding")).toBe(true);
  });

  it("does not fall back to gated text models when free RAM is lower than total RAM", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), constrainedMidSystem, {
      primaryUseCases: ["general_chat", "vision_understanding"],
      inputTypes: ["text", "screenshots"],
      priority: "quality",
      localPreference: "local_only",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: true,
      requiresImageGeneration: false,
    });

    expect(result.bundles.every((bundle) => bundle.textModel?.gated !== true)).toBe(true);
  });

  it("can report medium-or-better fit confidence for a strong vision workflow", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), strongSystem, {
      primaryUseCases: ["general_chat", "vision_understanding"],
      inputTypes: ["text", "screenshots"],
      priority: "quality",
      localPreference: "local_only",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: true,
      requiresImageGeneration: false,
    });

    expect(result.bundles.some((bundle) => bundle.fitConfidence !== "low")).toBe(true);
  });

  it("adds label-specific explanations instead of repeating the same lead reason", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), strongSystem, {
      primaryUseCases: ["general_chat", "vision_understanding"],
      inputTypes: ["text", "screenshots"],
      priority: "quality",
      localPreference: "local_only",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: true,
      requiresImageGeneration: false,
    });

    expect(result.bundles.find((bundle) => bundle.label === "best_overall")?.reasons[0]).toContain("overall balance");
    expect(result.bundles.find((bundle) => bundle.label === "fastest")?.reasons[0]).toContain("quickest viable stack");
    expect(result.bundles.find((bundle) => bundle.label === "best_quality")?.reasons[0]).toContain("prioritizes output quality");
    expect(result.bundles.find((bundle) => bundle.label === "most_local_friendly")?.reasons[0]).toContain("self-contained local setup");
  });

  it("produces bundles for a 16 GB unified-memory Mac profile", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), mac16System, {
      primaryUseCases: ["general_chat"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: false,
      requiresImageGeneration: false,
    });

    expect(result.bundles.length).toBeGreaterThan(0);
    expect(result.bundles[0]?.fitState).toBeDefined();
  });

  it("returns empty bundles with explanations when no text model fits memory constraints", () => {
    const tinyRam = systemProfileSchema.parse({
      ...lowEndSystem,
      ramGb: 4,
      freeRamGb: 3,
    });
    const result = rankRecommendedBundles(getSeedCandidateCollections(), tinyRam, {
      primaryUseCases: ["general_chat"],
      inputTypes: ["text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: false,
      requiresImageGeneration: false,
    });

    expect(result.bundles).toHaveLength(0);
    expect(result.noFitExplanations?.length).toBeGreaterThan(0);
  });

  it("collectNoFitExplanations lists embedding gap when required but none fit", () => {
    const tinyRam = systemProfileSchema.parse({
      ...lowEndSystem,
      ramGb: 4,
      freeRamGb: 3,
    });
    const lines = collectNoFitExplanations(getSeedCandidateCollections(), tinyRam, {
      primaryUseCases: ["documents"],
      inputTypes: ["pdf_text"],
      priority: "balanced",
      localPreference: "prefer_local",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: false,
      requiresImageGeneration: false,
    });
    expect(lines.some((l) => l.includes("text model") || l.includes("Embedding"))).toBe(true);
  });

  it("prefers more than one unique labeled bundle when alternatives exist", () => {
    const result = rankRecommendedBundles(getSeedCandidateCollections(), strongSystem, {
      primaryUseCases: ["general_chat", "vision_understanding"],
      inputTypes: ["text", "screenshots"],
      priority: "quality",
      localPreference: "local_only",
      allowsSlowSmart: true,
      requiresEmbeddings: true,
      requiresVision: true,
      requiresImageGeneration: false,
    });

    const signatures = new Set(
      result.bundles.map((bundle) =>
        [bundle.textModel?.id, bundle.embeddingModel?.id, bundle.visionModel?.id, bundle.imageModel?.id, bundle.loadStrategy]
          .filter(Boolean)
          .join("|"),
      ),
    );

    expect(signatures.size).toBeGreaterThan(1);
  });
});
