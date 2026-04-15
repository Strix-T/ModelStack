import { describe, expect, it } from "vitest";

import { exportJson } from "../src/core/export/exportJson.js";
import { exportMarkdown } from "../src/core/export/exportMarkdown.js";
import { getSeedCandidateCollections } from "../src/core/models/candidateRegistry.js";
import { renderRecommendationReport } from "../src/core/output/renderRecommendations.js";
import { rankRecommendedBundles } from "../src/core/scoring/finalRank.js";
import lowEndSystem from "./fixtures/system-low-end.json" with { type: "json" };
import midMacSystem from "./fixtures/system-mid-mac.json" with { type: "json" };
import { systemProfileSchema } from "../src/core/shared/schemas.js";
import { minimalIntent } from "./helpers/minimalIntent.js";

describe("output exporters", () => {
  it("renders terminal and markdown reports with the same major sections", () => {
    const result = rankRecommendedBundles(
      getSeedCandidateCollections(),
      systemProfileSchema.parse(midMacSystem),
      minimalIntent({
        primaryUseCases: ["documents"],
        inputTypes: ["pdf_text"],
        requiresEmbeddings: true,
        requiresVision: false,
      }),
    );

    const terminal = renderRecommendationReport(result);
    const markdown = exportMarkdown(result);
    const json = exportJson(result);

    expect(terminal).toContain("System Summary");
    expect(terminal).toContain("Recommended Stacks");
    expect(terminal).toContain("Recommended engine");
    expect(markdown).toContain("## System Summary");
    expect(markdown).toContain("## best overall");
    expect(markdown).toContain("Recommended engine");
    expect(JSON.parse(json).bundles).toHaveLength(4);
  });

  it("exports markdown when no bundle fits", () => {
    const tiny = systemProfileSchema.parse({ ...lowEndSystem, ramGb: 4, freeRamGb: 3 });
    const result = rankRecommendedBundles(getSeedCandidateCollections(), tiny, minimalIntent());

    const md = exportMarkdown(result);
    expect(result.bundles).toHaveLength(0);
    expect(md).toContain("No viable bundle");
    expect(md).toContain("No text model");
  });
});
