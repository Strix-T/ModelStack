import { confirm } from "@inquirer/prompts";
import { execa } from "execa";

import { buildInstallSteps } from "../core/output/installSteps.js";
import type { RecommendationResult, RecommendedBundle, SystemProfile } from "../core/shared/types.js";
import { pullOllamaModelsForBundle } from "./downloadModels.js";
import { ensureOllamaCli } from "./runtimeManager.js";
import { setupProjectEnvironment } from "./setupEnvironment.js";
import { collectOllamaPullTags } from "./ollamaTargets.js";
import {
  createApplyStepStates,
  renderStepList,
  setStepStatus,
  type ApplyStepId,
} from "./progressTracker.js";
import { isLargeDownloadRisk } from "./downloadRisk.js";
import { validateBundleAgainstSystem } from "./validateAgainstSystem.js";

export type ApplyStackDeps = {
  execaImpl?: typeof execa;
  onOllamaPullChunk?: (chunk: string) => void;
};

export type ApplyStackOptions = {
  result: RecommendationResult;
  liveSystem: SystemProfile;
  projectDir: string;
  bundleLabel?: string;
  assumeYes: boolean;
  onProgressText?: (summary: string) => void;
  deps?: ApplyStackDeps;
};

export type ApplyStackSuccess = {
  success: true;
  bundle: RecommendedBundle;
  mode: "ollama_ready" | "ollama_guided" | "non_ollama_guided";
  projectDir: string;
  notes: string[];
};

export type ApplyStackFailure = {
  success: false;
  reason: string;
  skippedBundleLabels: string[];
};

export type ApplyStackResult = ApplyStackSuccess | ApplyStackFailure;

export function resolveBundleStartIndex(bundles: RecommendedBundle[], bundleLabel?: string): number {
  if (bundles.length === 0) {
    throw new Error("No bundles in recommendation result.");
  }
  if (!bundleLabel) {
    return 0;
  }
  const i = bundles.findIndex((b) => b.label === bundleLabel);
  if (i === -1) {
    const valid = bundles.map((b) => b.label).join(", ");
    throw new Error(`Unknown bundle label "${bundleLabel}". Use one of: ${valid}`);
  }
  return i;
}

async function promptLargeDownloadIfNeeded(bundle: RecommendedBundle, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) {
    return true;
  }
  if (!isLargeDownloadRisk(bundle)) {
    return true;
  }
  if (!process.stdout.isTTY) {
    return true;
  }
  return confirm({
    message:
      "This stack may download several gigabytes of model files and use most of your free disk space. Continue?",
    default: true,
  });
}

function emitProgress(
  steps: ReturnType<typeof createApplyStepStates>,
  onProgressText: ApplyStackOptions["onProgressText"],
  id: ApplyStepId,
  status: "active" | "done" | "failed" | "skipped",
) {
  setStepStatus(steps, id, status);
  onProgressText?.(renderStepList(steps));
}

export async function applyStack(options: ApplyStackOptions): Promise<ApplyStackResult> {
  const { result, liveSystem, projectDir, bundleLabel, assumeYes, onProgressText, deps } = options;
  const steps = createApplyStepStates();
  const skipped: string[] = [];

  if (result.bundles.length === 0) {
    return {
      success: false,
      reason: "This recommendation file does not include any bundles to apply.",
      skippedBundleLabels: [],
    };
  }

  let start: number;
  try {
    start = resolveBundleStartIndex(result.bundles, bundleLabel);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, reason: msg, skippedBundleLabels: [] };
  }

  emitProgress(steps, onProgressText, "system_check", "active");

  let chosen: RecommendedBundle | undefined;
  for (let i = start; i < result.bundles.length; i++) {
    const bundle = result.bundles[i]!;
    const v = validateBundleAgainstSystem(bundle, liveSystem);
    if (!v.ok) {
      skipped.push(bundle.label);
      continue;
    }
    chosen = bundle;
    break;
  }

  setStepStatus(steps, "system_check", chosen ? "done" : "failed");
  onProgressText?.(renderStepList(steps));

  if (!chosen) {
    const detail =
      skipped.length > 0
        ? `None of the remaining bundles (starting from your selection) fit this machine right now. Skipped: ${skipped.join(", ")}.`
        : "No bundle in this file fits the current system check.";
    return {
      success: false,
      reason: detail,
      skippedBundleLabels: skipped,
    };
  }

  const installParts = {
    textModel: chosen.textModel,
    embeddingModel: chosen.embeddingModel,
    visionModel: chosen.visionModel,
    imageModel: chosen.imageModel,
    rerankerModel: chosen.rerankerModel,
  };

  if (chosen.recommendedEngine !== "ollama") {
    setStepStatus(steps, "runtime_setup", "skipped");
    onProgressText?.(renderStepList(steps));
    setStepStatus(steps, "model_download", "skipped");
    setStepStatus(steps, "environment_setup", "active");
    await setupProjectEnvironment(projectDir, result, chosen);
    setStepStatus(steps, "environment_setup", "done");
    setStepStatus(steps, "launch", "skipped");
    onProgressText?.(renderStepList(steps));

    const guided = buildInstallSteps(
      chosen.recommendedEngine,
      installParts,
      chosen.selectedTextVariant,
    );
    return {
      success: true,
      bundle: chosen,
      mode: "non_ollama_guided",
      projectDir,
      notes: [
        `Engine for this stack: ${chosen.recommendedEngine}. ModelStack does not auto-install this runtime yet.`,
        "",
        "Next steps:",
        ...guided.map((s) => `- ${s}`),
      ],
    };
  }

  setStepStatus(steps, "runtime_setup", "active");
  onProgressText?.(renderStepList(steps));

  const ollama = await ensureOllamaCli({ execaImpl: deps?.execaImpl });
  if (!ollama.ok) {
    setStepStatus(steps, "runtime_setup", "failed");
    setStepStatus(steps, "model_download", "skipped");
    setStepStatus(steps, "environment_setup", "skipped");
    setStepStatus(steps, "launch", "skipped");
    onProgressText?.(renderStepList(steps));
    return {
      success: false,
      reason: `${ollama.userTitle}\n\n${ollama.userBody}`,
      skippedBundleLabels: skipped,
    };
  }

  setStepStatus(steps, "runtime_setup", "done");
  onProgressText?.(renderStepList(steps));

  emitProgress(steps, onProgressText, "model_download", "active");

  const allowed = await promptLargeDownloadIfNeeded(chosen, assumeYes);
  if (!allowed) {
    setStepStatus(steps, "model_download", "skipped");
    setStepStatus(steps, "environment_setup", "skipped");
    setStepStatus(steps, "launch", "skipped");
    onProgressText?.(renderStepList(steps));
    return {
      success: false,
      reason: "Download cancelled. Run apply again when you are ready.",
      skippedBundleLabels: skipped,
    };
  }

  const pullResult = await pullOllamaModelsForBundle(chosen, {
    execaImpl: deps?.execaImpl,
    onPullChunk: deps?.onOllamaPullChunk,
  });

  if (pullResult.ok === false) {
    setStepStatus(steps, "model_download", "failed");
    setStepStatus(steps, "environment_setup", "skipped");
    setStepStatus(steps, "launch", "skipped");
    onProgressText?.(renderStepList(steps));
    return {
      success: false,
      reason: pullResult.userMessage,
      skippedBundleLabels: skipped,
    };
  }

  if (pullResult.ok === "skipped") {
    setStepStatus(steps, "model_download", "skipped");
    const guided = buildInstallSteps("ollama", installParts, chosen.selectedTextVariant);
    emitProgress(steps, onProgressText, "environment_setup", "active");
    await setupProjectEnvironment(projectDir, result, chosen);
    setStepStatus(steps, "environment_setup", "done");
    setStepStatus(steps, "launch", "skipped");
    onProgressText?.(renderStepList(steps));
    return {
      success: true,
      bundle: chosen,
      mode: "ollama_guided",
      projectDir,
      notes: [pullResult.reason, "", "Next steps:", ...guided.map((s) => `- ${s}`)],
    };
  }

  setStepStatus(steps, "model_download", "done");
  emitProgress(steps, onProgressText, "environment_setup", "active");
  await setupProjectEnvironment(projectDir, result, chosen);
  setStepStatus(steps, "environment_setup", "done");
  setStepStatus(steps, "launch", "skipped");
  onProgressText?.(renderStepList(steps));

  const tags = collectOllamaPullTags(chosen);
  return {
    success: true,
    bundle: chosen,
    mode: "ollama_ready",
    projectDir,
    notes: [`Pulled Ollama models: ${tags.join(", ")}`, `Project files are in ${projectDir}`],
  };
}
