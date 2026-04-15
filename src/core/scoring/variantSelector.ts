import { getVariantsForModel } from "../models/variantRegistry.js";
import type { CandidateModel, CandidateVariant, EngineId, SystemProfile, UserIntent } from "../shared/types.js";

export type VariantSelection = {
  variant: CandidateVariant | undefined;
  reasons: string[];
  skippedStronger: string[];
};

function precisionRank(p: CandidateVariant["precision"]): number {
  const order = ["q3", "q4", "q5", "q6", "q8", "int8", "bf16", "fp16", "unknown"];
  const i = order.indexOf(p);
  return i >= 0 ? i : 4;
}

function scoreVariant(v: CandidateVariant, intent: UserIntent, system: SystemProfile): number {
  let s = 0;
  const free = Math.max(system.freeRamGb ?? system.ramGb, 1);
  if (v.estimatedRamGb <= free * 0.85) {
    s += 2;
  } else if (v.estimatedRamGb <= free) {
    s += 0.5;
  } else {
    s -= 2;
  }

  switch (intent.quantizationTolerance) {
    case "prefer_efficiency":
      s += (10 - precisionRank(v.precision)) * 0.15;
      s += v.speedModifier * 0.4;
      break;
    case "prefer_quality":
      s += precisionRank(v.precision) * 0.12;
      s += v.qualityModifier * 0.5;
      break;
    default:
      s += v.speedModifier * 0.25 + v.qualityModifier * 0.25;
  }

  if (intent.contextPreference === "long_context" && v.contextClass === "long") {
    s += 0.8;
  }
  if (intent.contextPreference === "standard" && v.contextClass === "short") {
    s += 0.2;
  }

  if (intent.formatPreference !== "auto" && v.format !== intent.formatPreference) {
    s -= 1.5;
  }

  return s;
}

export function selectVariantForModel(
  model: CandidateModel,
  engine: EngineId,
  intent: UserIntent,
  system: SystemProfile,
): VariantSelection {
  const fromModel = model.variants ?? [];
  const fromRegistry = getVariantsForModel(model.id);
  const merged = [...fromModel, ...fromRegistry];
  const compatible = merged.filter((x) => x.engineCompatibility.includes(engine));

  if (compatible.length === 0) {
    return {
      variant: undefined,
      reasons: ["No curated variant matched this engine; using the model's default memory profile."],
      skippedStronger: [],
    };
  }

  const ranked = [...compatible].sort((a, b) => scoreVariant(b, intent, system) - scoreVariant(a, intent, system));
  const best = ranked[0];
  if (!best) {
    return {
      variant: undefined,
      reasons: ["No variant could be ranked; using the model's default memory profile."],
      skippedStronger: [],
    };
  }
  const skippedStronger = ranked
    .filter((x) => x !== best && precisionRank(x.precision) > precisionRank(best.precision))
    .slice(0, 2)
    .map((x) => `${x.quantLabel ?? x.precision} (${x.format})`);

  return {
    variant: best,
    reasons: [
      best.deployHint
        ? `Variant ${best.quantLabel ?? best.precision} via ${best.format}: ${best.deployHint}`
        : `Variant ${best.quantLabel ?? best.precision} (${best.format}) fits your engine and hardware heuristics.`,
    ],
    skippedStronger,
  };
}
