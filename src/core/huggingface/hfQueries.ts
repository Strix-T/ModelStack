import type { HfSearchTemplate } from "./types.js";

export const HF_SEARCH_TEMPLATES: HfSearchTemplate[] = [
  { kind: "text", search: "instruct", pipelineTag: "text-generation" },
  { kind: "text", search: "chat instruct", pipelineTag: "text-generation" },
  { kind: "text", search: "coder instruct", pipelineTag: "text-generation" },
  { kind: "text", search: "7b instruct", pipelineTag: "text-generation" },
  { kind: "text", search: "14b instruct", pipelineTag: "text-generation" },
  { kind: "embedding", search: "embed", pipelineTag: "sentence-similarity" },
  { kind: "embedding", search: "bge embedding", pipelineTag: "sentence-similarity" },
  { kind: "embedding", search: "e5 embedding", pipelineTag: "sentence-similarity" },
  { kind: "vision", search: "vision instruct", pipelineTag: "image-text-to-text" },
  { kind: "vision", search: "vl multimodal", pipelineTag: "image-text-to-text" },
  { kind: "vision", search: "document vision", pipelineTag: "image-text-to-text" },
  { kind: "image", search: "diffusion", pipelineTag: "text-to-image" },
  { kind: "image", search: "text to image", pipelineTag: "text-to-image" },
  { kind: "image", search: "sdxl", pipelineTag: "text-to-image" },
];
