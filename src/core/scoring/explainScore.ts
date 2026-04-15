import { getEngineDefinition } from "../engines/engineRegistry.js";
import type { EngineId, RecommendedBundle, UserIntent } from "../shared/types.js";
import { getBundleScoringWeights } from "./scoringProfiles.js";

export function explainBundleScore(bundle: RecommendedBundle, intent: UserIntent): string[] {
  const w = getBundleScoringWeights(intent);
  const lines: string[] = [
    `Scoring weights for this run (derived from priority and workload): speed ${(w.speed * 100).toFixed(0)}%, quality ${(w.quality * 100).toFixed(0)}%, local-friendliness ${(w.local * 100).toFixed(0)}%.`,
    `Primary engine ${getEngineDefinition(bundle.recommendedEngine).label} (${bundle.recommendedEngine}) with fallback ${getEngineDefinition(bundle.fallbackEngine).label}.`,
  ];

  if (bundle.selectedTextVariant) {
    lines.push(
      `Text variant ${bundle.selectedTextVariant.quantLabel ?? bundle.selectedTextVariant.precision} targets ${bundle.selectedTextVariant.format} on ${bundle.recommendedEngine}.`,
    );
  }

  if (bundle.skippedStrongerVariants && bundle.skippedStrongerVariants.length > 0) {
    lines.push(`Stronger or heavier variants skipped for fit: ${bundle.skippedStrongerVariants.join("; ")}.`);
  }

  if (bundle.memoryBreakdown) {
    lines.push(
      `Memory heuristic: model/base ~${bundle.memoryBreakdown.baseModelRamGb.toFixed(1)} GB, engine overhead ~${bundle.memoryBreakdown.engineOverheadGb.toFixed(1)} GB, KV/context buffer ~${bundle.memoryBreakdown.kvCacheRamGb.toFixed(1)} GB.`,
    );
  }

  return lines;
}
