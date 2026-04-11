export type HfModelListItem = {
  id: string;
  private?: boolean;
  gated?: string | boolean;
  pipeline_tag?: string;
  tags?: string[];
  siblings?: Array<{ rfilename?: string; size?: number; lfs?: { size?: number } }>;
  downloads?: number;
  likes?: number;
  library_name?: string;
  license?: string;
};

export type HfSearchTemplate = {
  kind: "text" | "embedding" | "vision" | "image";
  search: string;
  pipelineTag?: string;
};
