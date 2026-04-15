# ModelStack Upgrade Plan
_Last updated: 2026-04-12_

## Goal

Turn ModelStack from a strong **local model bundle recommender** into a true **AI stack architect** that recommends:

- the right **engine/runtime**
- the right **model variant / quantization**
- the right **supporting models** for retrieval, vision, and generation
- the right **installation path**
- the right **tradeoffs** for the user’s hardware and goals

The current codebase already has a solid foundation:
- terminal-first CLI workflow and bundle-based recommendations
- system detection across macOS / Windows / Linux
- seed registries for text, embeddings, vision, and image generation
- bundle planning, final rank selection, HF discovery/enrichment, and export/render flows
- tests covering system detection, questionnaire normalization, scoring, performance, output, and HF integration

This plan focuses on the highest-value upgrades.

---

## What the current system already does well

### Strengths to preserve
1. **Bundle-based recommendations**
   - ModelStack already recommends a stack, not a single model.
   - Keep this as the core product idea.

2. **Hardware-aware scoring**
   - Current scoring already uses free RAM, VRAM/unified memory, runtime availability, and memory headroom.
   - Preserve this direction.

3. **Multiple recommendation labels**
   - `best_overall`
   - `fastest`
   - `best_quality`
   - `most_local_friendly`

4. **No-fit explanations**
   - This is excellent UX and should remain first-class.

5. **HF discovery fallback**
   - Recommendations continue from seed candidates if online discovery fails.

---

## Biggest product gaps

### 1. No engine-aware recommendation layer
The current system stores runtime compatibility on candidates and checks installed runtimes, but runtime is still mostly a **bonus**, not a first-class recommendation axis.

This is the biggest missing feature.

Users do not just need:
- “Use Qwen 7B”

They need:
- “Use **Qwen 7B Q4_K_M via Ollama**”
- or “Use **Llama 3.2 3B GGUF in LM Studio**”
- or “Use **Transformers with Python** because you need vision/image support”

### 2. No quantization / variant awareness
Current memory profiles are static per model family, but real local deployment depends heavily on:
- GGUF quantization
- FP16 vs BF16 vs INT8 vs Q4/Q5/Q8
- context window sizing
- engine-specific overhead

Without this, recommendations can be directionally correct but practically wrong.

### 3. Task model is too shallow
Current tasks are strong enough for v1 but still too broad.

Missing high-value categories:
- reranking
- OCR-heavy document understanding
- speech-to-text
- text-to-speech
- tool calling / agents
- long-context chat
- code agent vs code completion vs repo analysis

### 4. Linux backend detection is too narrow
Current Linux detection is essentially:
- NVIDIA -> CUDA
- everything else -> unknown

Need explicit support for:
- AMD / ROCm
- Intel iGPU / oneAPI-ish realities
- CPU-only Linux classifications

### 5. Memory estimation is heuristic-only
The current bundle estimation is useful, but it does not distinguish:
- engine overhead
- KV cache growth
- quantization differences
- context window size
- multimodal image token overhead
- embedding batch/indexing spikes

### 6. Install / next-step guidance is generic
Current “next steps” are sensible but not operationally specific enough.
Need:
- engine-specific install instructions
- model-pull instructions
- quantization-specific setup hints
- better “why not this other option?” messaging

---

# Target architecture

## New recommendation hierarchy

ModelStack should recommend at four levels:

1. **Workflow archetype**
   - chat
   - coding
   - RAG/documents
   - vision + OCR
   - creative/image generation
   - hybrid assistant

2. **Engine/runtime**
   - Ollama
   - llama.cpp
   - Transformers (Python)
   - LM Studio
   - vLLM
   - MLC / MLX / Apple-specific options
   - “not sure” -> recommend best engine

3. **Model variant**
   - exact family/model
   - quantization / precision
   - format
   - context class

4. **Bundle**
   - text model
   - embedding model
   - reranker (optional)
   - vision model (optional)
   - image model (optional)
   - load strategy

---

# Phase 1 — Engine-aware recommendation system

## Objective
Make engine/runtime a first-class recommendation axis instead of a light score modifier.

## New questionnaire additions

Add new questions after local preference and before final normalization:

### New question: preferred engine
```ts
type PreferredEngine =
  | "auto"
  | "ollama"
  | "llamacpp"
  | "lm_studio"
  | "transformers"
  | "vllm"
  | "mlx";
```

Prompt:
- Recommend for me
- Ollama
- llama.cpp
- LM Studio
- Transformers / Python
- vLLM
- MLX / Apple Silicon

### New question: install comfort
```ts
type InstallComfort = "simple" | "moderate" | "advanced";
```

Prompt:
- Simplest setup possible
- Fine with a little setup
- I’m comfortable with advanced setup

### New question: model format preference
```ts
type ModelFormatPreference =
  | "auto"
  | "gguf"
  | "safetensors"
  | "onnx";
```

### New question: context preference
```ts
type ContextPreference = "standard" | "long_context" | "not_sure";
```

### New question: quantization tolerance
```ts
type QuantizationTolerance =
  | "prefer_quality"
  | "balanced"
  | "prefer_efficiency";
```

## Schema changes

### Update `userIntentSchema`
Add:
- `preferredEngine`
- `installComfort`
- `formatPreference`
- `contextPreference`
- `quantizationTolerance`

### Add engine enum
In shared constants/schema, replace broad runtime-only approach with explicit engine support:

```ts
export const SUPPORTED_ENGINES = [
  "ollama",
  "llamacpp",
  "lm_studio",
  "transformers",
  "vllm",
  "mlx",
  "other",
] as const;
```

Candidate models should still store compatible runtimes/engines, but recommendations should now explicitly select one.

## New file
`src/core/engines/engineRegistry.ts`

Define per-engine metadata:
- display name
- supported formats
- local friendliness
- install difficulty
- vision/image capability level
- Apple Silicon friendliness
- Windows friendliness
- Linux friendliness

Example:

```ts
export type EngineDefinition = {
  id: EngineId;
  label: string;
  supportsFormats: Array<"gguf" | "safetensors" | "onnx" | "other">;
  installDifficulty: "simple" | "moderate" | "advanced";
  strengths: string[];
  weaknesses: string[];
  supportsVisionWell: boolean;
  supportsImageGenerationWell: boolean;
  goodForAppleSilicon: boolean;
  goodForWindows: boolean;
  goodForLinux: boolean;
};
```

## New file
`src/core/engines/engineSelector.ts`

This should:
- select best engine based on:
  - user preference
  - installed runtimes
  - system OS/backend
  - tasks required
  - install comfort
- return:
  - selected engine
  - backup engine
  - reasons
  - warnings

## Scoring changes
Current scoring only adds runtime bonus in performance scoring.

Replace with:
- candidate/engine compatibility gate
- engine suitability multiplier
- install complexity multiplier
- task support multiplier

Do not allow a model to be recommended without an engine recommendation.

## Output changes
Every bundle should include:
- `recommendedEngine`
- `fallbackEngine`
- `engineReasons`

---

# Phase 2 — Quantization and variant-aware recommendations

## Objective
Recommend real deployable variants, not generic family names only.

## Schema changes

### Add model variant schema
New type:
```ts
type CandidateVariant = {
  variantId: string;
  baseModelId: string;
  format: "gguf" | "safetensors" | "onnx" | "other";
  precision: "fp16" | "bf16" | "int8" | "q8" | "q6" | "q5" | "q4" | "q3" | "unknown";
  quantLabel?: string;
  engineCompatibility: EngineId[];
  estimatedRamGb: number;
  estimatedVramGb?: number;
  contextClass: "short" | "standard" | "long";
  speedModifier: number;
  qualityModifier: number;
  localFriendly: boolean;
};
```

### Extend `candidateModelSchema`
Add optional:
- `variants`
- `defaultVariantStrategy`
- `contextWindow`
- `toolUseSupport`
- `multilingualSupport`
- `ocrStrength`
- `rerankFriendly`

## New files

### `src/core/models/variantRegistry.ts`
Initial curated variants for seed models.

Start with realistic local variants for:
- Gemma 2 2B
- Llama 3.2 3B
- Phi-3.5 mini
- Qwen2.5 7B
- Qwen2.5 Coder 7B
- Qwen2.5 14B
- Qwen2.5-VL 3B

For each base model define:
- Ollama-friendly default
- llama.cpp GGUF default
- Transformers full-precision default

### `src/core/scoring/variantSelector.ts`
Choose best variant from:
- user quantization tolerance
- hardware budget
- selected engine
- priority (speed vs quality)
- context preference

## Memory model changes
Replace one-size-fits-all estimated RAM with:
- base memory estimate
- variant-adjusted estimate
- engine overhead
- context overhead

Add:
```ts
type MemoryEstimateBreakdown = {
  baseModelRamGb: number;
  engineOverheadGb: number;
  kvCacheRamGb: number;
  secondaryModelsRamGb: number;
  totalEstimatedPeakRamGb: number;
  totalEstimatedPeakVramGb?: number;
  source: "heuristic" | "variant_heuristic" | "explicit_metadata";
};
```

## Output changes
Report:
- selected variant
- quantization / precision
- why that variant was chosen
- what stronger/weaker variants were skipped

---

# Phase 3 — Expanded task system

## Objective
Let ModelStack understand what the user actually wants more precisely.

## Replace current task tags with a more structured taxonomy

### Primary tasks
- chat
- writing
- coding
- documents
- scanned_documents
- screenshots
- photos
- image_generation
- speech_to_text
- text_to_speech
- agents
- reranking

### Capability flags
- needsEmbeddings
- needsReranker
- needsVision
- needsOCR
- needsImageGeneration
- needsToolCalling
- needsLongContext
- needsCodeBias
- needsMultilingual

## Files to update

### `src/core/questionnaire/questions.ts`
Expand use-case options:
- General chat
- Writing
- Coding
- Research / documents
- Scanned documents / OCR
- Screenshots / UI understanding
- Photos / visual understanding
- Image generation
- Voice transcription
- Voice responses
- Agents / tool use

### `src/core/questionnaire/normalizeAnswers.ts`
Derive:
- `requiresReranker`
- `requiresOCR`
- `requiresToolCalling`
- `requiresLongContext`
- `requiresSpeechToText`
- `requiresSpeechSynthesis`

### `src/core/huggingface/inferTasks.ts`
Add stronger inference for:
- reranker models
- OCR/document understanding
- speech
- TTS
- tool-use / instruct / function-calling style models

## Candidate collection changes
Add optional new buckets:
- `reranker`
- `speechToText`
- `textToSpeech`

You can keep them empty initially, but define the architecture now.

---

# Phase 4 — Better scoring model

## Objective
Make scoring dynamic and explainable.

## Current issue
The current system uses mostly fixed weights.

For example bundle overall currently leans:
- speed 0.4
- quality 0.45
- local 0.15

That is good for a first version, but it should adapt.

## New scoring strategy

### Dynamic weight profiles
Create scoring profiles by user priority and workflow:

```ts
type ScoringProfile = {
  speedWeight: number;
  qualityWeight: number;
  localWeight: number;
  simplicityWeight: number;
  memorySafetyWeight: number;
};
```

Examples:
- speed-first
- quality-first
- balanced
- coding-focused
- RAG-focused
- creator-focused

## New files

### `src/core/scoring/scoringProfiles.ts`
Maps user intent -> scoring profile

### `src/core/scoring/explainScore.ts`
Returns score breakdown:
- why candidate won
- why candidate lost
- which constraints forced downsize
- why engine X was chosen

## Changes to `performance.ts`
Current performance is good but should become:
- engine-aware
- variant-aware
- context-aware
- backend-aware

Add explicit penalties/bonuses for:
- unsupported engine/model format combos
- weak backend fit
- excessive memory slack vs too-tight fit
- quantization preference mismatch

## Changes to `bundlePlanner.ts`
Current combinator approach is solid.
Extend to:
- bundle = engine + variants + models
- optional reranker
- explicit OCR requirement handling
- explicit install simplicity score

---

# Phase 5 — Better system detection

## Objective
Improve real-world hardware/runtime recommendation accuracy.

## Linux
Extend `detectLinux.ts`:
- probe ROCm
- probe AMD GPU details
- probe Intel iGPU presence
- detect CPU-only systems explicitly
- better backend labeling

Possible probes:
- `rocminfo`
- `rocm-smi`
- `lspci`
- `glxinfo` / `vulkaninfo` fallback if available

## Windows
Improve:
- better GPU vendor/backend distinction
- WSL detection
- CUDA availability detection when NVIDIA exists
- Python venv / Transformers practicality hints

## macOS
Improve:
- Apple Silicon family parsing
- MLX/Metal suitability score
- better unified-memory heuristics for multimodal workloads

## Runtime detection
Extend installed runtime detection:
- `ollama`
- `llama-cli`
- `python` / `python3`
- `lm-studio`
- `uv`
- `mlx`
- `docker` (for vLLM-ish advanced users)

---

# Phase 6 — Better model data and seed registry

## Objective
Make recommendations more trustworthy and less hallucination-prone.

## Seed registry improvements
Current curated seeds are a strong start.
Expand with:
- more text models across small/medium/large classes
- coder-specific models
- multilingual embeddings
- rerankers
- OCR-friendly vision models
- creator-grade image models
- Apple-friendly options
- simple/local-first defaults

## Important rule
Do not over-rely on live HF discovery for correctness.
Use discovery to expand options, not replace curated recommendations.

## Add stronger curated metadata
For each seed model add:
- best engines
- recommended variants
- context class
- install complexity
- OCR strength
- coding strength
- tool-use strength
- multilingual score
- local simplicity score

---

# Phase 7 — Better UX and output

## Objective
Make the output operational, not just informative.

## Output changes
Current output shows:
- model IDs
- load strategy
- fit confidence
- warnings

Upgrade output to include:

### Required new sections
1. **Recommended engine**
2. **Recommended model variant**
3. **Why this was chosen**
4. **What stronger option was skipped**
5. **Install commands**
6. **Expected tradeoffs**
7. **Best use case for this stack**

### Example next steps
Instead of:
- “Install or confirm the runtime needed for the selected text model.”

Use:
- “Install Ollama if missing.”
- “Pull `qwen2.5:7b-instruct-q4_K_M`.”
- “Use `bge-base-en-v1.5` for indexing and do not switch later without rebuilding vectors.”
- “Load vision model on demand for scanned PDFs.”

## Add install instruction generator
New file:
`src/core/output/installSteps.ts`

It should emit engine-specific setup steps.

Examples:
- Ollama commands
- llama.cpp notes
- Transformers setup hints
- LM Studio import advice

---

# Phase 8 — Stack archetypes

## Objective
Help users understand what kind of setup they are getting.

## New file
`src/core/archetypes/archetypes.ts`

Examples:
- **Simple Local Chat**
- **Coding Copilot**
- **Document/RAG Stack**
- **Vision + OCR Assistant**
- **Creator Image Stack**
- **Hybrid Generalist Stack**

Each archetype defines:
- required capabilities
- recommended engines
- ideal hardware range
- expected bundle composition

## Use in output
Each recommendation should map to one archetype and display it prominently.

---

# Phase 9 — Testing plan

## Add tests for new architecture

### Questionnaire tests
- engine selection
- quantization preference
- install comfort
- long-context preference

### Scoring tests
- dynamic weights change ranking
- variant selection changes with hardware
- engine mismatch excludes candidates
- install simplicity changes recommendation

### System tests
- ROCm detection
- CPU-only Linux
- CUDA vs DirectML vs Metal vs unknown
- MLX detection on Apple Silicon

### Output tests
- install instructions render
- engine info renders
- variant info renders
- no-fit explanations include engine/variant reasons

### Registry tests
- seed model variant coverage
- no duplicate variant IDs
- engine compatibility integrity

---

# Concrete file-by-file implementation plan

## Update existing files

### `src/core/shared/constants.ts`
Add:
- supported engines
- supported task families
- supported quantization labels

### `src/core/shared/schemas.ts`
Add:
- engine enum/schema
- variant schema
- extended user intent fields
- optional reranker/STT/TTS bundle fields
- memory estimate breakdown schema

### `src/core/shared/types.ts`
Re-export all new inferred types.

### `src/core/questionnaire/questions.ts`
Add:
- preferred engine
- install comfort
- format preference
- context preference
- quantization tolerance
- expanded workload types

### `src/core/questionnaire/flows.ts`
Ask the new questions in order.

### `src/core/questionnaire/normalizeAnswers.ts`
Derive richer capability flags.

### `src/core/system/detectLinux.ts`
Add ROCm/AMD/Intel handling.

### `src/core/system/detectSystem.ts`
Expand runtime detection and backend normalization.

### `src/core/models/candidateRegistry.ts`
Add new candidate groups and variants attachment path.

### `src/core/scoring/performance.ts`
Make engine/variant/context-aware.

### `src/core/scoring/bundlePlanner.ts`
Bundle engine + variants + optional reranker.

### `src/core/scoring/finalRank.ts`
Rank final bundles with dynamic scoring profiles and better delta explanations.

### `src/core/output/renderRecommendations.ts`
Render engine + variant + install steps.

### `src/core/export/exportMarkdown.ts`
Include:
- engine
- variant
- install commands
- archetype
- memory breakdown

## New files to add

### Engines
- `src/core/engines/engineRegistry.ts`
- `src/core/engines/engineSelector.ts`

### Variants
- `src/core/models/variantRegistry.ts`
- `src/core/scoring/variantSelector.ts`

### Archetypes
- `src/core/archetypes/archetypes.ts`

### Scoring
- `src/core/scoring/scoringProfiles.ts`
- `src/core/scoring/explainScore.ts`

### Output
- `src/core/output/installSteps.ts`

### Optional future buckets
- `src/core/models/curatedRerankers.ts`
- `src/core/models/curatedSpeechToText.ts`
- `src/core/models/curatedTextToSpeech.ts`

---

# Suggested implementation order

## Sprint 1 — Highest value
1. Add engine selection question
2. Add engine registry + selector
3. Update schemas/types for engine fields
4. Include engine in output
5. Add install instructions

## Sprint 2
1. Add variant/quantization schema
2. Add curated variants for existing seed models
3. Add variant selector
4. Update memory estimation for variants

## Sprint 3
1. Expand task taxonomy
2. Add reranker/OCR capability flags
3. Improve HF task inference

## Sprint 4
1. Improve Linux/Windows detection
2. Add dynamic scoring profiles
3. Add better score explanations

## Sprint 5
1. Add archetypes
2. Polish export/reporting
3. Expand curated registries

---

# Recommended defaults for v2

If the user chooses “Recommend for me”:
- **Apple Silicon simple local** -> prefer `ollama` or `mlx`
- **Windows simple local** -> prefer `ollama`
- **Linux advanced + strong GPU** -> consider `vllm` or `transformers`
- **Need image generation / richer multimodal** -> prefer `transformers`
- **Need easiest path** -> prefer `ollama`

Variant defaults:
- speed-first -> q4/q5 class
- balanced -> q4/q5 or small safetensors
- quality-first -> q6/q8/fp16 depending on engine and hardware

---

# Success criteria

This upgrade is successful when ModelStack can do all of the following:

1. Recommend **an engine**, not just a model.
2. Recommend **a deployable model variant**, not just a family name.
3. Explain **why** the recommendation fits the user’s hardware and goals.
4. Handle **documents, OCR, coding, vision, and image generation** more precisely.
5. Produce **installable next steps**.
6. Stay useful when offline or when HF discovery fails.
7. Maintain conservative behavior on uncertain hardware.

---

# Final product direction

The north star is:

> ModelStack should become the **PCPartPicker for local AI stacks**.

That means:
- practical
- opinionated
- installation-aware
- variant-aware
- engine-aware
- honest about tradeoffs

Do not let it drift into generic “model suggestions.”
Its value is in **complete stack decisions**.

