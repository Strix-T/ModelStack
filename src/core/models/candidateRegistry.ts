import { candidateCollectionsSchema } from "../shared/schemas.js";
import type { CandidateCollections, CandidateModel } from "../shared/types.js";
import { curatedEmbeddingModels } from "./curatedEmbeddings.js";
import { curatedImageModels } from "./curatedImageGen.js";
import { curatedTextModels } from "./curatedText.js";
import { curatedVisionModels } from "./curatedVision.js";

export function getSeedCandidateCollections(): CandidateCollections {
  return candidateCollectionsSchema.parse({
    text: curatedTextModels,
    embedding: curatedEmbeddingModels,
    vision: curatedVisionModels,
    image: curatedImageModels,
  });
}

export function mergeCandidateCollections(...collections: CandidateCollections[]): CandidateCollections {
  const merged = collections.reduce<CandidateCollections>(
    (acc, collection) => ({
      text: mergeById(acc.text, collection.text),
      embedding: mergeById(acc.embedding, collection.embedding),
      vision: mergeById(acc.vision, collection.vision),
      image: mergeById(acc.image, collection.image),
    }),
    {
      text: [],
      embedding: [],
      vision: [],
      image: [],
    },
  );

  return candidateCollectionsSchema.parse(merged);
}

function mergeById(left: CandidateModel[], right: CandidateModel[]): CandidateModel[] {
  const map = new Map<string, CandidateModel>();
  for (const item of [...left, ...right]) {
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}
