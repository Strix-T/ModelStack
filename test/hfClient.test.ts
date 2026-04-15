import { describe, expect, it } from "vitest";

import { parseHfModelToCandidate } from "../src/core/huggingface/parseModelInfo.js";
import { HfClient } from "../src/core/huggingface/hfClient.js";
import { getSeedCandidateCollections } from "../src/core/models/candidateRegistry.js";
import { rankRecommendedBundles } from "../src/core/scoring/finalRank.js";
import midMacSystem from "./fixtures/system-mid-mac.json" with { type: "json" };
import { systemProfileSchema } from "../src/core/shared/schemas.js";
import { minimalIntent } from "./helpers/minimalIntent.js";

describe("Hugging Face integration", () => {
  it("tags GGUF repos as Ollama- and llama.cpp-compatible", () => {
    const candidate = parseHfModelToCandidate(
      {
        id: "fixture/gguf-weights",
        pipeline_tag: "text-generation",
        siblings: [{ rfilename: "model-Q4_K_M.gguf", lfs: { size: 4 * 1024 ** 3 } }],
      },
      "text",
    );
    expect(candidate.runtime).toContain("ollama");
    expect(candidate.runtime).toContain("llamacpp");
  });

  it("discovers bounded candidates from the API", async () => {
    const client = new HfClient({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify([
            {
              id: "test-org/test-3b-instruct",
              pipeline_tag: "text-generation",
              tags: ["transformers", "safetensors"],
              siblings: [{ rfilename: "model.safetensors", lfs: { size: 4 * 1024 ** 3 } }],
            },
          ]),
        )) as typeof fetch,
      baseUrl: "https://example.com",
    });

    const result = await client.discoverCandidates(1);
    expect(result.collections.text.length).toBeGreaterThan(0);
  });

  it("prefers higher-download models when trimming to the discovery limit", async () => {
    const client = new HfClient({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify([
            {
              id: "low/popular",
              pipeline_tag: "text-generation",
              tags: ["safetensors"],
              downloads: 50,
              likes: 1,
              siblings: [{ rfilename: "model.safetensors", size: 1e9 }],
            },
            {
              id: "high/popular",
              pipeline_tag: "text-generation",
              tags: ["safetensors"],
              downloads: 9_000_000,
              likes: 4000,
              siblings: [{ rfilename: "model.safetensors", size: 1e9 }],
            },
          ]),
        )) as typeof fetch,
      baseUrl: "https://example.com",
    });

    const result = await client.discoverCandidates(1);
    const ids = result.collections.text.map((c) => c.id);
    expect(ids).toContain("high/popular");
    expect(ids).not.toContain("low/popular");
  });

  it("allows recommendations to continue from seed candidates when discovery fails", async () => {
    const client = new HfClient({
      fetchImpl: (async () => {
        throw new Error("network unavailable");
      }) as typeof fetch,
      baseUrl: "https://example.com",
    });

    const discovered = await client.discoverCandidates(1);
    expect(discovered.warnings.length).toBeGreaterThan(0);

    const result = rankRecommendedBundles(
      getSeedCandidateCollections(),
      systemProfileSchema.parse(midMacSystem),
      minimalIntent({ requiresEmbeddings: false }),
    );

    expect(result.bundles.length).toBe(4);
  });
});
