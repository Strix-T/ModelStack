import type { CandidateModel } from "../shared/types.js";

export const curatedRerankerModels: CandidateModel[] = [
  {
    id: "BAAI/bge-reranker-base",
    kind: "reranker",
    family: "bge",
    runtime: ["transformers"],
    tasks: ["reranking", "documents"],
    localFriendly: true,
    estimatedRamGb: 4,
    speedTier: 4,
    qualityTier: 4,
    source: "seed",
    gated: false,
    formats: ["safetensors"],
    parameterClass: "small",
    memoryProfile: {
      minRamGb: 4,
      recommendedRamGb: 8,
    },
    discoveryConfidence: "high",
    rerankFriendly: true,
    notes: ["Cross-encoder reranker for RAG; keep batch sizes modest on CPU."],
  },
];
