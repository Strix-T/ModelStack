import { recommendationResultSchema } from "../shared/schemas.js";
import type { CandidateCollections, RecommendationResult, RecommendedBundle, SystemProfile, UserIntent } from "../shared/types.js";
import { buildBundleScorecards, collectNoFitExplanations } from "./bundlePlanner.js";

const labelSelectors = {
  best_overall: (card: ReturnType<typeof buildBundleScorecards>[number]) => card.overall,
  fastest: (card: ReturnType<typeof buildBundleScorecards>[number]) => card.speed,
  best_quality: (card: ReturnType<typeof buildBundleScorecards>[number]) => card.quality,
  most_local_friendly: (card: ReturnType<typeof buildBundleScorecards>[number]) => card.local + card.overall * 0.2,
} as const;

type BundleScorecard = ReturnType<typeof buildBundleScorecards>[number];

export function rankRecommendedBundles(
  collections: CandidateCollections,
  system: SystemProfile,
  intent: UserIntent,
  cacheWarnings: string[] = [],
): RecommendationResult {
  const scorecards = buildBundleScorecards(collections, system, intent);
  if (scorecards.length === 0) {
    return recommendationResultSchema.parse({
      system,
      intent,
      bundles: [],
      noFitExplanations: collectNoFitExplanations(collections, system, intent),
      generatedAt: new Date().toISOString(),
      cacheWarnings,
    });
  }

  const bundles = selectBundles(scorecards);

  return recommendationResultSchema.parse({
    system,
    intent,
    bundles,
    generatedAt: new Date().toISOString(),
    cacheWarnings,
  });
}

function selectBundles(scorecards: BundleScorecard[]): RecommendedBundle[] {
  const selectedIds = new Set<string>();
  const selectedCards: Array<{ label: RecommendedBundle["label"]; card: BundleScorecard }> = [];

  for (const [label, selector] of Object.entries(labelSelectors) as Array<[RecommendedBundle["label"], (card: BundleScorecard) => number]>) {
    const ranked = [...scorecards].sort((a, b) => selector(b) - selector(a) || b.overall - a.overall);
    const chosen = chooseRankedBundle(label, ranked, selectedCards);
    if (!chosen) {
      continue;
    }

    selectedIds.add(signature(chosen.bundle));
    const baseline = selectedCards.find((entry) => entry.label === "best_overall")?.card;
    selectedCards.push({ label, card: chosen });

    const annotatedBundle = annotateBundleForLabel(
      {
        ...chosen.bundle,
        label,
      },
      label,
      baseline ?? chosen,
    );

    if (!selectedIds.has(signature(annotatedBundle))) {
      selectedIds.add(signature(annotatedBundle));
    }
  }

  return selectedCards.map(({ label, card }) =>
    annotateBundleForLabel(
      {
        ...card.bundle,
        label,
      },
      label,
      selectedCards.find((entry) => entry.label === "best_overall")?.card ?? card,
    ),
  );
}

function chooseRankedBundle(
  label: RecommendedBundle["label"],
  ranked: BundleScorecard[],
  selected: Array<{ label: RecommendedBundle["label"]; card: BundleScorecard }>,
): BundleScorecard | undefined {
  const unused = ranked.filter((card) => !selected.some((entry) => signature(entry.card.bundle) === signature(card.bundle)));
  if (unused.length === 0) {
    return ranked[0];
  }

  if (selected.length === 0) {
    return unused[0];
  }

  const minDifference = label === "best_overall" ? 0 : 2;
  const diverse = unused.find((card) => selected.every((entry) => bundleDifferenceCount(card.bundle, entry.card.bundle) >= minDifference));
  if (diverse) {
    return diverse;
  }

  const somewhatDiverse = unused.find((card) => selected.every((entry) => bundleDifferenceCount(card.bundle, entry.card.bundle) >= 1));
  if (somewhatDiverse) {
    return somewhatDiverse;
  }

  return unused[0];
}

function bundleDifferenceCount(left: RecommendedBundle, right: RecommendedBundle): number {
  const leftParts = [
    left.textModel?.id,
    left.selectedTextVariant?.variantId,
    left.embeddingModel?.id,
    left.visionModel?.id,
    left.imageModel?.id,
    left.rerankerModel?.id,
    left.speechToTextModel?.id,
    left.textToSpeechModel?.id,
    left.recommendedEngine,
    left.loadStrategy,
  ];
  const rightParts = [
    right.textModel?.id,
    right.selectedTextVariant?.variantId,
    right.embeddingModel?.id,
    right.visionModel?.id,
    right.imageModel?.id,
    right.rerankerModel?.id,
    right.speechToTextModel?.id,
    right.textToSpeechModel?.id,
    right.recommendedEngine,
    right.loadStrategy,
  ];

  return leftParts.reduce((count, part, index) => count + (part === rightParts[index] ? 0 : 1), 0);
}

function annotateBundleForLabel(
  bundle: RecommendedBundle,
  label: RecommendedBundle["label"],
  baseline: BundleScorecard,
): RecommendedBundle {
  const labelReason = getLabelReason(bundle, label, baseline.bundle);
  const deltaReason = getDeltaReason(bundle, label, baseline.bundle);
  const reasons = [
    labelReason,
    deltaReason,
    ...bundle.reasons.filter(
      (reason) =>
        !reason.startsWith(bundle.textModel?.id ?? "") &&
        !reason.startsWith("This stack leans") &&
        !reason.startsWith("Load strategy"),
    ),
  ];

  const warnings = uniqueLines([
    getLabelTradeoff(bundle, label, baseline.bundle),
    ...bundle.warnings,
  ]);

  const nextSteps = uniqueLines([
    getLabelNextStep(label),
    ...bundle.nextSteps,
  ]);

  return {
    ...bundle,
    reasons: uniqueLines(reasons),
    warnings,
    nextSteps,
  };
}

function getLabelReason(bundle: RecommendedBundle, label: RecommendedBundle["label"], baseline: RecommendedBundle): string {
  switch (label) {
    case "best_overall":
      return "This is the strongest overall balance among the current viable candidates for your system and stated goals.";
    case "fastest":
      return "This is the quickest viable stack among the top candidates, chosen to reduce latency and startup drag.";
    case "best_quality":
      return "This stack prioritizes output quality over raw speed, even when it demands more patience or headroom.";
    case "most_local_friendly":
      return "This stack stays closest to a self-contained local setup with the least reliance on heavier or less portable options.";
  }
}

function getDeltaReason(bundle: RecommendedBundle, label: RecommendedBundle["label"], baseline: RecommendedBundle): string {
  const ramDelta = Math.round((bundle.estimatedPeakRamGb - baseline.estimatedPeakRamGb) * 10) / 10;

  switch (label) {
    case "best_overall":
      return `${bundle.textModel?.id ?? "The primary text model"} anchors the stack for ${bundle.label.replaceAll("_", " ")} use without overcommitting to just one metric.`;
    case "fastest":
      if (ramDelta < 0) {
        return `Compared with Best Overall, this bundle trims about ${Math.abs(ramDelta)} GB of peak RAM to stay more responsive.`;
      }
      return `Compared with Best Overall, this bundle favors the lighter or quicker-loading model choices where possible.`;
    case "best_quality":
      if (ramDelta > 0) {
        return `Compared with Best Overall, this bundle spends about ${ramDelta} GB more peak RAM to chase stronger outputs.`;
      }
      return `Compared with Best Overall, this bundle leans on the highest-quality model pairing available for your requested tasks.`;
    case "most_local_friendly":
      return `Compared with Best Overall, this bundle emphasizes local-friendly formats and runtimes, even if that reduces variety or peak performance.`;
  }
}

function getLabelTradeoff(bundle: RecommendedBundle, label: RecommendedBundle["label"], baseline: RecommendedBundle): string {
  const ramDelta = Math.round((bundle.estimatedPeakRamGb - baseline.estimatedPeakRamGb) * 10) / 10;

  switch (label) {
    case "best_overall":
      return "This recommendation balances the tradeoffs, so it may not be the absolute best on any single dimension.";
    case "fastest":
      return ramDelta > 0
        ? `Even the fastest viable option here still carries a sizable memory footprint, roughly ${ramDelta} GB away from Best Overall.`
        : "This faster-leaning option gives up some quality headroom to stay more responsive.";
    case "best_quality":
      return "This quality-first option may respond more slowly and can demand more setup discipline than the faster variants.";
    case "most_local_friendly":
      return "The most local-friendly stack is optimized for staying self-contained, not for winning every quality or speed comparison.";
  }
}

function getLabelNextStep(label: RecommendedBundle["label"]): string {
  switch (label) {
    case "best_overall":
      return "Start with this bundle if you want one recommendation that covers the broadest day-to-day usage.";
    case "fastest":
      return "Use this stack first if responsiveness matters more than squeezing out the last bit of quality.";
    case "best_quality":
      return "Use this stack when you are willing to trade speed and headroom for better outputs.";
    case "most_local_friendly":
      return "Use this stack if staying fully local and operationally simple matters most.";
  }
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return [...new Set(lines.filter((line): line is string => Boolean(line && line.trim())))];
}

function signature(bundle: RecommendedBundle): string {
  return [
    bundle.textModel?.id,
    bundle.selectedTextVariant?.variantId,
    bundle.embeddingModel?.id,
    bundle.visionModel?.id,
    bundle.imageModel?.id,
    bundle.rerankerModel?.id,
    bundle.speechToTextModel?.id,
    bundle.textToSpeechModel?.id,
    bundle.recommendedEngine,
    bundle.loadStrategy,
  ]
    .filter(Boolean)
    .join("|");
}
