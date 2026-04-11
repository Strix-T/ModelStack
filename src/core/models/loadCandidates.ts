import { HfClient } from "../huggingface/hfClient.js";
import { CACHE_VERSION } from "../shared/constants.js";
import { readCacheSnapshot, writeCacheSnapshot } from "../shared/io.js";
import type { CacheSnapshot, CandidateCollections } from "../shared/types.js";
import { mergeCandidateCollections, getSeedCandidateCollections } from "./candidateRegistry.js";

export type LoadCandidateOptions = {
  offlineOnly?: boolean;
  forceRefresh?: boolean;
  hfClient?: HfClient;
};

export async function refreshCandidateCache(options: LoadCandidateOptions = {}): Promise<{ snapshot: CacheSnapshot; filePath: string }> {
  const seedCandidates = getSeedCandidateCollections();
  const client = options.hfClient ?? new HfClient();
  const { collections: discoveredCandidates, warnings } = await client.discoverCandidates();
  const merged = mergeCandidateCollections(seedCandidates, discoveredCandidates);

  const enrichedCandidates = await enrichAllCandidates(merged, client, warnings);
  const filePath = await writeCacheSnapshot({
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    seedCandidates,
    discoveredCandidates,
    enrichedCandidates,
    warnings,
  });

  return {
    snapshot: {
      version: CACHE_VERSION,
      generatedAt: new Date().toISOString(),
      seedCandidates,
      discoveredCandidates,
      enrichedCandidates,
      warnings,
    },
    filePath,
  };
}

export async function loadCandidateCollections(options: LoadCandidateOptions = {}): Promise<{ collections: CandidateCollections; warnings: string[] }> {
  const seedCandidates = getSeedCandidateCollections();
  const cache = await readCacheSnapshot();

  if (options.offlineOnly) {
    return {
      collections: mergeCandidateCollections(seedCandidates, cache?.enrichedCandidates ?? emptyCollections()),
      warnings: cache ? [...cache.warnings, "Using offline-only candidate data."] : ["Using seed registry only; no cache snapshot found."],
    };
  }

  if (!options.forceRefresh && cache) {
    return {
      collections: mergeCandidateCollections(seedCandidates, cache.enrichedCandidates),
      warnings: cache.warnings,
    };
  }

  const refreshed = await refreshCandidateCache(options);
  return {
    collections: mergeCandidateCollections(seedCandidates, refreshed.snapshot.enrichedCandidates),
    warnings: refreshed.snapshot.warnings,
  };
}

async function enrichAllCandidates(
  collections: CandidateCollections,
  client: HfClient,
  warnings: string[],
): Promise<CandidateCollections> {
  return {
    text: await enrichList(collections.text, client, warnings),
    embedding: await enrichList(collections.embedding, client, warnings),
    vision: await enrichList(collections.vision, client, warnings),
    image: await enrichList(collections.image, client, warnings),
  };
}

async function enrichList(models: CandidateCollections["text"], client: HfClient, warnings: string[]) {
  const enriched = await Promise.all(
    models.map(async (model) => {
      try {
        return await client.enrichCandidate(model);
      } catch (error) {
        warnings.push(
          `Metadata enrichment failed for ${model.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        return model;
      }
    }),
  );

  return enriched;
}

function emptyCollections(): CandidateCollections {
  return {
    text: [],
    embedding: [],
    vision: [],
    image: [],
  };
}
