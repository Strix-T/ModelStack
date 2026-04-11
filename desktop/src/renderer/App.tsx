import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { INPUT_TYPE_OPTIONS, PDF_OPTIONS, PRIMARY_USE_CASE_OPTIONS } from "@modelstack/core/questionnaire/questions.js";
import type { QuestionnaireAnswers } from "@modelstack/core/questionnaire/normalizeAnswers.js";
import type { RecommendationResult, SystemProfile } from "@modelstack/core/shared/types.js";
import { formatGbForDisplay } from "@modelstack/core/shared/formatGb.js";

type WizardStep =
  | "welcome"
  | "scan"
  | "uses"
  | "inputs"
  | "pdf"
  | "priority"
  | "local"
  | "slow"
  | "imageExtra"
  | "running"
  | "results";

function buildInputTypes(
  raw: string[],
  pdfType: "pdf_text" | "pdf_scanned" | "both" | null,
  primaryUseCases: string[],
): QuestionnaireAnswers["inputTypes"] {
  const inputTypes: QuestionnaireAnswers["inputTypes"] = [];
  for (const item of raw) {
    if (item === "mixed") {
      inputTypes.push("text", "pdf_text", "screenshots", "code");
      continue;
    }
    if (
      item === "text" ||
      item === "pdf_text" ||
      item === "screenshots" ||
      item === "photos" ||
      item === "code"
    ) {
      inputTypes.push(item);
    }
  }

  if (inputTypes.includes("pdf_text") || primaryUseCases.includes("documents")) {
    if (pdfType === "both") {
      inputTypes.push("pdf_scanned");
    } else if (pdfType === "pdf_scanned") {
      const textIndex = inputTypes.indexOf("pdf_text");
      if (textIndex >= 0) {
        inputTypes.splice(textIndex, 1);
      }
      inputTypes.push("pdf_scanned");
    }
  }

  return [...new Set(inputTypes)];
}

function specRow(label: string, value: ReactNode): JSX.Element {
  return (
    <div>
      <dt className="inline font-medium text-slate-800 dark:text-slate-200">{label}:</dt>{" "}
      <dd className="inline break-words">{value}</dd>
    </div>
  );
}

function formatOptionalGb(value: number | undefined): string {
  return value === undefined ? "—" : `${formatGbForDisplay(value)} GB`;
}

/** Discrete VRAM is not exposed on Apple Silicon; the GPU uses the unified memory pool. */
function formatGpuVramDisplay(system: SystemProfile): string {
  if (system.gpuVramGb !== undefined) {
    return `${formatGbForDisplay(system.gpuVramGb)} GB`;
  }
  const appleSiliconGpu =
    system.gpuVendor === "Apple" || /\bApple M[0-9]/.test(system.gpuModel ?? "");
  if (appleSiliconGpu && system.unifiedMemoryGb !== undefined) {
    return "N/A (Apple Silicon — GPU shares unified memory, not separate VRAM)";
  }
  if (system.os === "macos" && system.unifiedMemoryGb !== undefined) {
    return "N/A (macOS — no discrete VRAM reported; GPU may use system memory)";
  }
  if (system.unifiedMemoryGb !== undefined) {
    return "N/A (shared system memory — no discrete VRAM reported)";
  }
  return "—";
}

function SystemSpecsSection({ system }: { system: SystemProfile }): JSX.Element {
  const runtimes = system.runtimes;
  return (
    <section className="mb-8 rounded-xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/40">
      <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">System specs</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Hardware ModelStack detected for this run. Use this to confirm detection matches your machine before trusting
        recommendations.
      </p>
      <dl className="mt-4 grid gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        {specRow("Operating system", system.os)}
        {specRow("CPU", system.cpuModel)}
        {specRow("CPU cores", system.cpuCores)}
        {specRow("Total RAM", `${formatGbForDisplay(system.ramGb)} GB`)}
        {specRow("Free RAM (est.)", formatOptionalGb(system.freeRamGb))}
        {specRow("Hardware band", system.hardwareBand)}
        {specRow("GPU vendor", system.gpuVendor ?? "—")}
        {specRow("GPU model", system.gpuModel ?? "—")}
        {specRow("GPU VRAM (est.)", formatGpuVramDisplay(system))}
        {specRow("Unified memory (est.)", formatOptionalGb(system.unifiedMemoryGb))}
        {specRow("Storage free (est.)", formatOptionalGb(system.storageFreeGb))}
        {specRow("GPU backend", system.gpuBackend ?? "—")}
        {specRow("Detection confidence", system.confidence)}
        {specRow("Ollama installed", runtimes.ollamaInstalled ? "Yes" : "No")}
        {specRow("llama.cpp CLI installed", runtimes.llamaCppInstalled ? "Yes" : "No")}
        {specRow("Python installed", runtimes.pythonInstalled ? "Yes" : "No")}
      </dl>
      {system.detectionWarnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 p-3 dark:border-amber-900/40 dark:bg-amber-950/50">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Detection notes</p>
          <ul className="mt-2 list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
            {system.detectionWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function formatCatalogTime(iso: string | null): string {
  if (!iso) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function useThemeSync(): void {
  useEffect(() => {
    let offProgress: (() => void) | undefined;
    void window.modelstack.getTheme().then(({ shouldUseDarkColors }) => {
      document.documentElement.classList.toggle("dark", shouldUseDarkColors);
    });
    offProgress = window.modelstack.onNativeThemeChanged(({ shouldUseDarkColors }) => {
      document.documentElement.classList.toggle("dark", shouldUseDarkColors);
    });
    return () => {
      offProgress?.();
    };
  }, []);
}

export default function App() {
  useThemeSync();

  const [step, setStep] = useState<WizardStep>("welcome");
  const [system, setSystem] = useState<SystemProfile | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [primaryUseCases, setPrimaryUseCases] = useState<string[]>(["general_chat"]);
  const [rawInputTypes, setRawInputTypes] = useState<string[]>(["text"]);
  const [pdfType, setPdfType] = useState<"pdf_text" | "pdf_scanned" | "both" | null>(null);
  const [priority, setPriority] = useState<QuestionnaireAnswers["priority"]>("balanced");
  const [localPreference, setLocalPreference] = useState<QuestionnaireAnswers["localPreference"]>("prefer_local");
  const [allowsSlowSmart, setAllowsSlowSmart] = useState(true);
  const [wantsImageGen, setWantsImageGen] = useState<boolean | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState("");
  const [catalog, setCatalog] = useState<{
    refreshing: boolean;
    generatedAt: string | null;
    error: string | null;
  }>({ refreshing: false, generatedAt: null, error: null });

  useEffect(() => {
    void window.modelstack.getCatalogInfo().then(setCatalog);
    return window.modelstack.onCatalogStatus(setCatalog);
  }, []);

  const needsPdfStep = useMemo(() => {
    const hasPdf = rawInputTypes.includes("pdf_text") || rawInputTypes.includes("mixed");
    return hasPdf || primaryUseCases.includes("documents");
  }, [rawInputTypes, primaryUseCases]);

  const needsImageStep = useMemo(() => !primaryUseCases.includes("image_generation"), [primaryUseCases]);

  const finalAnswers = useMemo((): QuestionnaireAnswers => {
    let finalPrimary = [...primaryUseCases];
    if (needsImageStep && wantsImageGen) {
      finalPrimary = [...finalPrimary, "image_generation"];
    }
    const pdf = needsPdfStep ? pdfType : null;
    return {
      primaryUseCases: finalPrimary as QuestionnaireAnswers["primaryUseCases"],
      inputTypes: buildInputTypes(rawInputTypes, pdf, primaryUseCases),
      priority,
      localPreference,
      allowsSlowSmart,
    };
  }, [
    primaryUseCases,
    rawInputTypes,
    pdfType,
    priority,
    localPreference,
    allowsSlowSmart,
    wantsImageGen,
    needsPdfStep,
    needsImageStep,
  ]);

  const runScan = useCallback(async () => {
    setScanError(null);
    setStatusLine("Scanning hardware…");
    try {
      const profile = (await window.modelstack.scan()) as SystemProfile;
      setSystem(profile);
      setStep("uses");
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setStatusLine("");
    }
  }, []);

  const goNextFromInputs = useCallback(() => {
    if (needsPdfStep) {
      if (!pdfType) {
        setPdfType("pdf_text");
      }
      setStep("pdf");
    } else {
      setStep("priority");
    }
  }, [needsPdfStep, pdfType]);

  const runRecommend = useCallback(async () => {
    setRunError(null);
    setStep("running");
    setStatusLine("Starting…");
    const off = window.modelstack.onProgress((data) => {
      const p = data as { phase?: string };
      if (p.phase === "scan_start") {
        setStatusLine("Scanning system…");
      }
      if (p.phase === "scan_done") {
        setStatusLine("Loading candidate pool…");
      }
      if (p.phase === "candidates_start") {
        setStatusLine("Loading models…");
      }
      if (p.phase === "candidates_done") {
        setStatusLine("Scoring recommendations…");
      }
      if (p.phase === "score_done") {
        setStatusLine("");
      }
    });
    try {
      if (needsPdfStep && !pdfType) {
        setPdfType("pdf_text");
      }
      const answers = {
        ...finalAnswers,
        inputTypes: buildInputTypes(rawInputTypes, needsPdfStep ? pdfType ?? "pdf_text" : null, primaryUseCases),
      };
      const res = (await window.modelstack.recommend({
        answers: {
          primaryUseCases: answers.primaryUseCases,
          inputTypes: answers.inputTypes,
          priority: answers.priority,
          localPreference: answers.localPreference,
          allowsSlowSmart: answers.allowsSlowSmart,
        },
        offlineOnly: true,
      })) as RecommendationResult;
      setResult(res);
      setStep("results");
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Recommendation failed");
      setStep(needsImageStep ? "imageExtra" : "slow");
    } finally {
      off();
      setStatusLine("");
    }
  }, [finalAnswers, needsImageStep, needsPdfStep, pdfType, primaryUseCases, rawInputTypes]);

  const saveMd = useCallback(async () => {
    if (!result) {
      return;
    }
    const md = await window.modelstack.markdownForResult(result);
    const save = await window.modelstack.saveMarkdown({
      content: md,
      defaultFileName: "modelstack-report.md",
    });
    if (save.ok && save.filePath) {
      setStatusLine(`Saved to ${save.filePath}`);
      setTimeout(() => setStatusLine(""), 4000);
    }
  }, [result]);

  const copyJson = useCallback(async () => {
    if (!result) {
      return;
    }
    await window.modelstack.copyText(JSON.stringify(result, null, 2));
    setStatusLine("JSON copied to clipboard");
    setTimeout(() => setStatusLine(""), 2500);
  }, [result]);

  const refreshCache = useCallback(async () => {
    setStatusLine("Refreshing cache…");
    try {
      await window.modelstack.refreshCache();
      setStatusLine("Cache refreshed");
      setTimeout(() => setStatusLine(""), 3000);
    } catch (e) {
      setStatusLine(e instanceof Error ? e.message : "Cache refresh failed");
    }
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              ModelStack
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Plan a realistic local AI stack for this computer</p>
          </div>
          <div className="flex max-w-xs flex-col items-end gap-2 text-right">
            <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
              {catalog.refreshing ? (
                <>Updating catalog from Hugging Face…</>
              ) : catalog.error ? (
                <>
                  {catalog.generatedAt ? (
                    <>
                      Last snapshot: {formatCatalogTime(catalog.generatedAt)}.{" "}
                    </>
                  ) : null}
                  <span className="text-amber-700 dark:text-amber-400">Refresh failed: {catalog.error}</span>
                </>
              ) : catalog.generatedAt ? (
                <>Catalog updated {formatCatalogTime(catalog.generatedAt)}</>
              ) : (
                <>No catalog on disk yet.</>
              )}
            </p>
            <button
              type="button"
              disabled={catalog.refreshing}
              onClick={() => void refreshCache()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh catalog
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {statusLine ? (
          <p className="mb-6 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
            {statusLine}
          </p>
        ) : null}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          {step === "welcome" ? (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">Welcome</h2>
              <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                ModelStack syncs the Hugging Face model catalog in the background when you open the app (when online),
                scans this machine, asks a few questions about how you work, then suggests local model stacks that fit
                your RAM, GPU, and goals. The header shows when the catalog was last updated.
              </p>
              <button
                type="button"
                onClick={() => setStep("scan")}
                className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-brand-700"
              >
                Get started
              </button>
            </div>
          ) : null}

          {step === "scan" ? (
            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">System scan</h2>
              <p className="text-slate-600 dark:text-slate-300">We read CPU, memory, GPU, and disk headroom from your OS.</p>
              {scanError ? <p className="text-sm text-red-600 dark:text-red-400">{scanError}</p> : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void runScan()}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
                >
                  Scan this computer
                </button>
                <button
                  type="button"
                  onClick={() => setStep("welcome")}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Back
                </button>
              </div>
              {system ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
                  <p>
                    <span className="font-medium">OS:</span> {system.os} · <span className="font-medium">RAM:</span>{" "}
                    {system.ramGb} GB
                  </p>
                  <p>
                    <span className="font-medium">CPU:</span> {system.cpuModel}
                  </p>
                  <p>
                    <span className="font-medium">GPU:</span> {system.gpuModel ?? "Unknown"}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "uses" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">What do you mainly use AI for?</h2>
              <div className="grid gap-2">
                {PRIMARY_USE_CASE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={primaryUseCases.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPrimaryUseCases([...primaryUseCases, opt.value]);
                        } else {
                          setPrimaryUseCases(primaryUseCases.filter((v) => v !== opt.value));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={primaryUseCases.length === 0}
                  onClick={() => setStep("inputs")}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  Continue
                </button>
                <button type="button" onClick={() => setStep("scan")} className="rounded-xl border px-4 py-3 dark:border-slate-600">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "inputs" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">What files will the AI work with?</h2>
              <div className="grid gap-2">
                {INPUT_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={rawInputTypes.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRawInputTypes([...rawInputTypes, opt.value]);
                        } else {
                          setRawInputTypes(rawInputTypes.filter((v) => v !== opt.value));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={rawInputTypes.length === 0}
                  onClick={() => goNextFromInputs()}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  Continue
                </button>
                <button type="button" onClick={() => setStep("uses")} className="rounded-xl border px-4 py-3 dark:border-slate-600">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "pdf" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">About your PDFs</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Are they mostly selectable text or scanned pages?</p>
              <div className="space-y-2">
                {PDF_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <input
                      type="radio"
                      name="pdf"
                      checked={pdfType === opt.value}
                      onChange={() => setPdfType(opt.value)}
                      className="h-4 w-4"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!pdfType}
                  onClick={() => setStep("priority")}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  Continue
                </button>
                <button type="button" onClick={() => setStep("inputs")} className="rounded-xl border px-4 py-3 dark:border-slate-600">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "priority" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">What matters most?</h2>
              <div className="space-y-2">
                {(
                  [
                    { value: "speed" as const, label: "Fast responses" },
                    { value: "quality" as const, label: "Best quality" },
                    { value: "balanced" as const, label: "Balanced" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === opt.value}
                      onChange={() => setPriority(opt.value)}
                      className="h-4 w-4"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("local")}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => setStep(needsPdfStep ? "pdf" : "inputs")}
                  className="rounded-xl border px-4 py-3 dark:border-slate-600"
                >
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "local" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">Local preference</h2>
              <div className="space-y-2">
                {(
                  [
                    { value: "local_only" as const, label: "Fully local only" },
                    { value: "prefer_local" as const, label: "Prefer local" },
                    { value: "no_preference" as const, label: "No preference" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <input
                      type="radio"
                      name="local"
                      checked={localPreference === opt.value}
                      onChange={() => setLocalPreference(opt.value)}
                      className="h-4 w-4"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("slow")}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white"
                >
                  Continue
                </button>
                <button type="button" onClick={() => setStep("priority")} className="rounded-xl border px-4 py-3 dark:border-slate-600">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "slow" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">Smarter but slower models?</h2>
              {runError ? <p className="text-sm text-red-600 dark:text-red-400">{runError}</p> : null}
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="radio"
                    name="slow"
                    checked={allowsSlowSmart === true}
                    onChange={() => setAllowsSlowSmart(true)}
                    className="h-4 w-4"
                  />
                  <span>Yes, okay with slower models if they are smarter</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="radio"
                    name="slow"
                    checked={allowsSlowSmart === false}
                    onChange={() => setAllowsSlowSmart(false)}
                    className="h-4 w-4"
                  />
                  <span>No, prefer faster responses</span>
                </label>
              </div>
              <div className="flex gap-3">
                {needsImageStep ? (
                  <button
                    type="button"
                    onClick={() => setStep("imageExtra")}
                    className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void runRecommend()}
                    className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white"
                  >
                    Get recommendations
                  </button>
                )}
                <button type="button" onClick={() => setStep("local")} className="rounded-xl border px-4 py-3 dark:border-slate-600">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "imageExtra" ? (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold dark:text-white">Image generation</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Will you want image generation too?</p>
              {runError ? <p className="text-sm text-red-600 dark:text-red-400">{runError}</p> : null}
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="radio"
                    name="img"
                    checked={wantsImageGen === false}
                    onChange={() => setWantsImageGen(false)}
                    className="h-4 w-4"
                  />
                  <span>No</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="radio"
                    name="img"
                    checked={wantsImageGen === true}
                    onChange={() => setWantsImageGen(true)}
                    className="h-4 w-4"
                  />
                  <span>Yes</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={wantsImageGen === null}
                  onClick={() => void runRecommend()}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  Get recommendations
                </button>
                <button type="button" onClick={() => setStep("slow")} className="rounded-xl border px-4 py-3 dark:border-slate-600">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === "running" ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-slate-600 dark:text-slate-300">{statusLine || "Working…"}</p>
            </div>
          ) : null}

          {step === "results" && result ? (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold dark:text-white">Recommendations</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setStep("uses");
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyJson()}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
                  >
                    Copy JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveMd()}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
                  >
                    Save Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => void runRecommend()}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white"
                  >
                    Run again
                  </button>
                </div>
              </div>

              <SystemSpecsSection system={result.system} />

              {result.noFitExplanations && result.noFitExplanations.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/40">
                  <p className="font-medium text-amber-900 dark:text-amber-100">No full stack fit</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-amber-800 dark:text-amber-200">
                    {result.noFitExplanations.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-6">
                {result.bundles.map((bundle) => (
                  <article
                    key={bundle.label}
                    className="rounded-xl border border-slate-200 p-5 dark:border-slate-700 dark:bg-slate-800/30"
                  >
                    <h3 className="font-display text-lg font-semibold capitalize text-slate-900 dark:text-white">
                      {bundle.label.replaceAll("_", " ")}
                    </h3>
                    <dl className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                      <div>
                        <dt className="inline font-medium text-slate-800 dark:text-slate-200">Text:</dt>{" "}
                        <dd className="inline">{bundle.textModel?.id ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Embedding:</dt>{" "}
                        <dd className="inline">{bundle.embeddingModel?.id ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Vision:</dt>{" "}
                        <dd className="inline">{bundle.visionModel?.id ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Image:</dt>{" "}
                        <dd className="inline">{bundle.imageModel?.id ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Load:</dt>{" "}
                        <dd className="inline">{bundle.loadStrategy}</dd>
                      </div>
                      {bundle.fitState ? (
                        <div>
                          <dt className="inline font-medium">Fit:</dt>{" "}
                          <dd className="inline">{bundle.fitState}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="inline font-medium">Peak RAM (est.):</dt>{" "}
                        <dd className="inline">{formatGbForDisplay(bundle.estimatedPeakRamGb)} GB</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Confidence:</dt>{" "}
                        <dd className="inline">{bundle.fitConfidence}</dd>
                      </div>
                    </dl>
                    {bundle.warnings.length > 0 ? (
                      <ul className="mt-3 list-inside list-disc text-sm text-amber-800 dark:text-amber-200">
                        {bundle.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>

              {result.cacheWarnings.length > 0 ? (
                <div className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                  <p className="font-medium">Cache / discovery notes</p>
                  <ul className="mt-2 list-inside list-disc">
                    {result.cacheWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Estimates are heuristic. Verify RAM/VRAM and runtime support before committing to a stack.
        </p>
      </main>
    </div>
  );
}
