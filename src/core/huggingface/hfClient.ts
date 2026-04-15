import { DEFAULT_DISCOVERY_LIMIT, DEFAULT_HF_TIMEOUT_MS } from "../shared/constants.js";
import { candidateCollectionsSchema, candidateModelSchema } from "../shared/schemas.js";
import type { CandidateCollections, CandidateModel } from "../shared/types.js";
import { HF_SEARCH_TEMPLATES } from "./hfQueries.js";
import { parseHfModelToCandidate } from "./parseModelInfo.js";
import type { HfModelListItem, HfSearchTemplate } from "./types.js";

export type HfClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

async function fetchJson<T>(url: string, options: HfClientOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_HF_TIMEOUT_MS);

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Hugging Face request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function buildSearchUrl(template: HfSearchTemplate, baseUrl: string, limit: number): string {
  const url = new URL("/api/models", baseUrl);
  url.searchParams.set("search", template.search);
  url.searchParams.set("limit", String(limit));
  if (template.pipelineTag) {
    url.searchParams.set("pipeline_tag", template.pipelineTag);
  }
  return url.toString();
}

export class HfClient {
  constructor(private readonly options: HfClientOptions = {}) {}

  async fetchModel(modelId: string): Promise<HfModelListItem> {
    const baseUrl = this.options.baseUrl ?? "https://huggingface.co";
    return fetchJson<HfModelListItem>(`${baseUrl}/api/models/${modelId}`, this.options);
  }

  async enrichCandidate(candidate: CandidateModel): Promise<CandidateModel> {
    const fetched = await this.fetchModel(candidate.id);
    const parsed = parseHfModelToCandidate(fetched, candidate.kind);
    return candidateModelSchema.parse({
      ...candidate,
      ...parsed,
      source: "enriched",
      discoveryConfidence: candidate.discoveryConfidence,
      notes: [...new Set([...(candidate.notes ?? []), ...(parsed.notes ?? [])])],
    });
  }

  async discoverCandidates(limit = DEFAULT_DISCOVERY_LIMIT): Promise<{ collections: CandidateCollections; warnings: string[] }> {
    const baseUrl = this.options.baseUrl ?? "https://huggingface.co";
    const discovered: CandidateCollections = {
      text: [],
      embedding: [],
      vision: [],
      image: [],
      reranker: [],
      speechToText: [],
      textToSpeech: [],
    };
    const warnings: string[] = [];

    await Promise.all(
      HF_SEARCH_TEMPLATES.map(async (template) => {
        try {
          const items = await fetchJson<HfModelListItem[]>(buildSearchUrl(template, baseUrl, limit), this.options);
          const parsed = items
            .filter((item) => !item.private)
            .sort((a, b) => {
              const da = a.downloads ?? 0;
              const db = b.downloads ?? 0;
              if (db !== da) {
                return db - da;
              }
              return (b.likes ?? 0) - (a.likes ?? 0);
            })
            .slice(0, limit)
            .map((item) => parseHfModelToCandidate(item, template.kind));
          const bucket = discovered[template.kind];
          const seen = new Set(bucket.map((c) => c.id));
          for (const candidate of parsed) {
            if (!seen.has(candidate.id)) {
              seen.add(candidate.id);
              bucket.push(candidate);
            }
          }
        } catch (error) {
          warnings.push(
            `Discovery for ${template.kind} candidates failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }),
    );

    return {
      collections: candidateCollectionsSchema.parse(discovered),
      warnings,
    };
  }
}
