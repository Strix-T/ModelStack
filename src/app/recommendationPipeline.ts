import { exportMarkdown } from "../core/export/exportMarkdown.js";
import { loadCandidateCollections, refreshCandidateCache } from "../core/models/loadCandidates.js";
import type { RecommendationResult, SystemProfile, UserIntent } from "../core/shared/types.js";
import { rankRecommendedBundles } from "../core/scoring/finalRank.js";
import { detectSystem } from "../core/system/detectSystem.js";

export type RecommendationProgress =
  | { phase: "scan_start" }
  | { phase: "scan_done"; system: SystemProfile }
  | { phase: "candidates_start" }
  | { phase: "candidates_done"; warnings: string[] }
  | { phase: "score_start" }
  | { phase: "score_done"; result: RecommendationResult };

export type RecommendationProgressCallback = (progress: RecommendationProgress) => void;

export async function getSystemProfile(): Promise<SystemProfile> {
  return detectSystem();
}

export async function runRecommendationPipeline(options: {
  intent: UserIntent;
  /** When set (e.g. CLI after an initial scan), skips running detectSystem again. */
  system?: SystemProfile;
  offlineOnly?: boolean;
  fast?: boolean;
  onProgress?: RecommendationProgressCallback;
}): Promise<RecommendationResult> {
  const onProgress = options.onProgress ?? (() => {});

  onProgress({ phase: "scan_start" });
  const system = options.system ?? (await detectSystem());
  onProgress({ phase: "scan_done", system });

  const intent = options.fast ? { ...options.intent, priority: "speed" as const } : options.intent;

  onProgress({ phase: "candidates_start" });
  const { collections, warnings } = await loadCandidateCollections({
    offlineOnly: options.offlineOnly,
  });
  onProgress({ phase: "candidates_done", warnings });

  onProgress({ phase: "score_start" });
  const result = rankRecommendedBundles(collections, system, intent, warnings);
  onProgress({ phase: "score_done", result });

  return result;
}

export function recommendationResultToMarkdown(result: RecommendationResult): string {
  return exportMarkdown(result);
}

export async function runRefreshCachePipeline(): Promise<{
  generatedAt: string;
  filePath: string;
  warnings: string[];
}> {
  const { snapshot, filePath } = await refreshCandidateCache();
  return {
    generatedAt: snapshot.generatedAt,
    filePath,
    warnings: snapshot.warnings,
  };
}
