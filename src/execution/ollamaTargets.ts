import type { CandidateModel, CandidateVariant, RecommendedBundle } from "../core/shared/types.js";

export function extractOllamaTagsFromText(text: string): string[] {
  const tags: string[] = [];
  for (const m of text.matchAll(/ollama\s+pull\s+(\S+)/gi)) {
    const tag = m[1];
    if (tag) {
      tags.push(tag);
    }
  }
  return tags;
}

function collectFromVariant(variant: CandidateVariant | undefined): string[] {
  if (!variant?.deployHint) {
    return [];
  }
  return extractOllamaTagsFromText(variant.deployHint);
}

function collectFromModelVariants(model: CandidateModel | undefined): string[] {
  if (!model?.variants?.length) {
    return [];
  }
  const out: string[] = [];
  for (const v of model.variants) {
    out.push(...collectFromVariant(v));
  }
  return out;
}

/** Ordered, deduplicated Ollama image tags to pull for this bundle. */
export function collectOllamaPullTags(bundle: RecommendedBundle): string[] {
  const ordered: string[] = [];

  const pushUnique = (tags: string[]) => {
    for (const t of tags) {
      if (!ordered.includes(t)) {
        ordered.push(t);
      }
    }
  };

  pushUnique(collectFromVariant(bundle.selectedTextVariant));
  pushUnique(collectFromModelVariants(bundle.embeddingModel));
  pushUnique(collectFromModelVariants(bundle.visionModel));
  pushUnique(collectFromModelVariants(bundle.imageModel));
  pushUnique(collectFromModelVariants(bundle.rerankerModel));
  pushUnique(collectFromModelVariants(bundle.speechToTextModel));
  pushUnique(collectFromModelVariants(bundle.textToSpeechModel));

  return ordered;
}

/** Tag for `ollama run` (primary text model), if known from deploy hints. */
export function primaryOllamaRunTag(bundle: RecommendedBundle): string | undefined {
  const fromText = collectFromVariant(bundle.selectedTextVariant);
  if (fromText[0]) {
    return fromText[0];
  }
  const all = collectOllamaPullTags(bundle);
  return all[0];
}
