# ModelStack — Cursor Ready Fix Plan

This plan turns the audit into a concrete implementation roadmap so ModelStack gives stronger, more trustworthy recommendations, uses correct system facts, and avoids overconfident or misleading output.

The current codebase already has a solid structure: system detection, questionnaire normalization, candidate loading, scoring, bundle planning, and labeled recommendation output. The problems are mostly in detection accuracy, candidate selection safety, discovery depth, and confidence/reporting. The goal of this plan is to make recommendations more correct, more explainable, and less likely to hallucinate or overpromise.

Relevant source files in the current repo include the CLI flow and scoring pipeline in `src/cli/index.ts`, `src/cli/commands/recommend.ts`, `src/core/questionnaire/normalizeAnswers.ts`, `src/core/models/loadCandidates.ts`, `src/core/scoring/eligibility.ts`, `src/core/scoring/bundlePlanner.ts`, `src/core/scoring/finalRank.ts`, and the platform detectors in `src/core/system/*`. The existing app behavior is also described in the README. fileciteturn3file14 fileciteturn2file0

---

## Primary goals

1. Fix incorrect system facts, especially on macOS.
2. Prevent the engine from recommending models that are not actually viable.
3. Improve candidate discovery so “best recommendation” is based on a stronger pool.
4. Make confidence and warnings more honest.
5. Add tests so recommendation logic is reproducible and less brittle.
6. Reduce hallucination risk by separating known facts, inferred estimates, and low-confidence guesses.

---

## Summary of issues to fix

### 1. macOS GPU detection is wrong
The current macOS detector uses `machdep.cpu.brand_string` as the GPU model, which is a CPU string, not a GPU string. This pollutes the system profile and can mislead the recommendation output. The current detector does set Metal and unified memory, but the GPU model itself is not trustworthy. fileciteturn3file0

### 2. Image generation incorrectly implies vision requirements
The questionnaire normalization currently marks `requiresVision = true` when `image_generation` is selected. That is not logically required for text-to-image generation and can force larger bundles than needed. fileciteturn2file0

### 3. Fallback selection can return ineligible models
When no candidates survive ranking, `pickTop()` falls back to the smallest non-gated model without re-checking full eligibility, which can produce recommendations that violate memory fit or local-only constraints. fileciteturn3file4turn3file1

### 4. Launcher and README paths are mismatched
The macOS bootstrap script computes `PROJECT_DIR` as if it lives inside a child directory, while the uploaded file is located in the repo root. The README also references a different path than the uploaded script path. fileciteturn2file2 fileciteturn3file14

### 5. Candidate discovery is too shallow
Discovery uses a very small, generic Hugging Face query set. That is fine for a prototype, but not enough for high-quality recommendations across coding, OCR, multilingual, or runtime-specific local workflows. fileciteturn2file0

### 6. Discovered task inference is too naive
Task inference relies heavily on model-id substring heuristics like `coder` and `instruct`. That causes under-classification and misclassification of discovered models. fileciteturn2file0

### 7. Eligibility only checks total RAM, not practical available headroom
Eligibility currently checks minimum RAM against total RAM, not current free RAM. That means the engine can still mark models as eligible even when they are not realistic under current memory pressure. fileciteturn0file0

### 8. Memory estimation is too generic
Bundle memory estimation is useful as a first approximation, but it does not yet distinguish enough across runtime, format, quantization style, and unified-memory systems. fileciteturn3file3turn3file4

### 9. Seed registry is too small to support “best” language confidently
The curated registry is a good starter set, but too small to justify strong claims across many hardware and workload combinations. fileciteturn0file0

### 10. The system does not clearly separate fact from estimate
The current report shows a clean recommendation output, but it does not strongly distinguish:
- measured system facts
- inferred candidate metadata
- heuristic memory estimates
- lower-confidence recommendations

That increases the chance of sounding more certain than the engine really is. fileciteturn0file0

---

# Implementation plan

## Phase 1 — Fix correctness bugs first

These changes should be done before widening discovery.

### Fix 1A — Correct macOS GPU detection

#### Files
- `src/core/system/detectMac.ts`
- `src/core/system/detectSystem.ts`
- add tests under `test/system/`

#### Problem
`detectMac()` uses:
- `sysctl -n hw.memsize` for unified memory
- `sysctl -n machdep.cpu.brand_string` for `gpuModel`

That second command is wrong for GPU detection. fileciteturn3file0

#### Required change
Replace the current GPU-model logic with a macOS-specific GPU probe.

#### Recommended implementation
Use a layered strategy:

1. Try `system_profiler SPDisplaysDataType -json`
2. If that fails, fall back to `system_profiler SPDisplaysDataType`
3. If that also fails, leave `gpuModel` undefined and emit a warning
4. Never use CPU brand as a GPU label

#### Example target behavior
- Apple Silicon machine:
  - `gpuBackend = "metal"`
  - `unifiedMemoryGb = correct`
  - `gpuModel = "Apple M4"` or the best parsed GPU/display controller label available
- Intel Mac with AMD GPU:
  - `gpuModel = actual adapter/display GPU label`

#### Suggested code shape
```ts
export async function detectMac(runner: ExecaMethod): Promise<NativeProbeResult> {
  const warnings: string[] = [];
  const sysctlMem = await runCommand(runner, "sysctl", ["-n", "hw.memsize"]);
  const gpuJson = await runCommand(runner, "system_profiler", ["SPDisplaysDataType", "-json"]);

  let gpuModel: string | undefined;
  let gpuVendor: string | undefined;

  if (gpuJson) {
    const parsed = JSON.parse(gpuJson);
    const controllers = parsed?.SPDisplaysDataType;
    const first = Array.isArray(controllers) ? controllers[0] : undefined;
    gpuModel = first?.sppci_model ?? first?._name;
    gpuVendor = first?.spdisplays_vendor ?? first?.spdisplays_vendor_id;
  }

  if (!gpuModel) {
    warnings.push("macOS GPU probe could not determine a reliable GPU model.");
  }

  return {
    gpuBackend: "metal",
    unifiedMemoryGb: sysctlMem ? bytesToGb(Number(sysctlMem)) : undefined,
    gpuModel,
    gpuVendor,
    warnings,
  };
}
```

#### Acceptance criteria
- macOS scans never use CPU brand as `gpuModel`
- missing GPU model yields warning, not fake data
- system profile remains valid and confidence reflects missing GPU detail

#### Tests
- parse a mocked `system_profiler` JSON result for Apple Silicon
- parse a mocked `system_profiler` JSON result for discrete AMD/NVIDIA macOS output
- confirm fallback warning when profiler output is unavailable

---

### Fix 1B — Stop treating image generation as requiring vision

#### Files
- `src/core/questionnaire/normalizeAnswers.ts`
- tests under `test/questionnaire/`

#### Problem
`requiresVision` is currently set to true when `image_generation` is selected. That is too broad. fileciteturn2file0

#### Required change
Make `requiresVision` depend only on actual image-understanding needs:
- `vision_understanding`
- `pdf_scanned`
- `screenshots`
- `photos`

#### Target logic
```ts
const requiresVision =
  answers.primaryUseCases.includes("vision_understanding") ||
  inputTypes.includes("pdf_scanned") ||
  inputTypes.includes("screenshots") ||
  inputTypes.includes("photos");
```

#### Acceptance criteria
- a text-to-image-only user is not forced into a vision bundle
- users with scanned PDFs or screenshots still correctly require vision

#### Tests
- `image_generation` only → `requiresVision = false`
- `vision_understanding` → `requiresVision = true`
- `pdf_scanned` → `requiresVision = true`

---

### Fix 1C — Remove unsafe fallback recommendations

#### Files
- `src/core/scoring/bundlePlanner.ts`
- `src/core/scoring/finalRank.ts`
- optionally `src/core/shared/types.ts` if a no-fit result is introduced
- tests under `test/scoring/`

#### Problem
`pickTop()` can return a model that is non-gated but still not truly eligible. That can lead to bad recommendations on weak machines or strict local-only scenarios. fileciteturn3file4turn3file1

#### Required change
Do not silently return unsafe fallbacks.

#### Better behavior
Use a two-stage fallback:

1. Try fully eligible candidates
2. If none exist, try “degraded but still truthful” candidates with explicit flags
3. If still none exist, return no recommendation bundle and surface a structured explanation

#### Recommended implementation options

##### Option A — strict mode
If no eligible text model exists, return no scorecards and let the command say:
- no viable fully local stack was found
- suggest lower requirements, cloud fallback, or smaller workloads

##### Option B — degraded local mode
Introduce a `fitStatus` field such as:
- `viable`
- `tight_fit`
- `degraded_only`
- `not_viable`

Then only recommend `degraded_only` when it is honest and clearly labeled.

#### Suggested immediate v1 fix
Update `pickTop()` so fallback candidates must still satisfy at least:
- local preference compatibility
- task relevance
- minimum RAM
- minimum VRAM if needed

If none do, return an empty list.

#### Acceptance criteria
- weak systems do not get impossible recommendations
- local-only users do not receive non-local-friendly models
- bundle generation fails honestly when there is no safe option

#### Tests
- no eligible text model returns empty result or explicit no-fit state
- local-only does not fallback to non-local-friendly candidate
- low-memory system does not fallback to too-large candidate

---

### Fix 1D — Fix launcher and README path mismatch

#### Files
- `bootstrap_modelstack_mac.sh`
- `README.md`

#### Problem
The script resolves project directory as if the script sits under a child directory, but the uploaded script is in repo root. The README also points to a different path. fileciteturn2file2 fileciteturn3file14

#### Required change
Pick one consistent structure.

#### Recommended approach
Because this is a terminal-first CLI, keep the script in `scripts/bootstrap_modelstack_mac.sh` and update both script and README.

#### Concrete steps
1. Move file to `scripts/bootstrap_modelstack_mac.sh`
2. Keep:
```sh
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
```
3. Ensure `Run ModelStack.command` points to the new location
4. Update README examples to use the new path

#### Acceptance criteria
- double-click launcher works from fresh clone
- README install/run instructions match actual repo layout
- custom `MODELSTACK_COMMAND` examples work exactly as documented

#### Tests
- manual smoke test from clean machine or clean temp clone
- verify script succeeds when invoked from Finder/Terminal

---

## Phase 2 — Improve recommendation quality

### Fix 2A — Expand the curated registry substantially

#### Files
- `src/core/models/curatedText.ts`
- `src/core/models/curatedEmbeddings.ts`
- `src/core/models/curatedVision.ts`
- `src/core/models/curatedImageGen.ts`
- possibly split into multiple files by family/tier

#### Problem
The current seed registry is too small to support broad recommendation quality. fileciteturn0file0

#### Required change
Expand curated candidates into a stronger baseline set with explicit metadata overrides.

#### Recommended structure
For each model, store:
- runtime support
- typical local friendliness
- intended tasks
- parameter class
- memory profile
- quality tier
- speed tier
- confidence in metadata
- notes that explain when to use it

#### Recommended categories to add

##### Text
Add more candidates across:
- tiny/fast laptops
- balanced 7B/8B class
- quality-first 14B class
- coding-first
- general chat
- multilingual if you want that supported

##### Embeddings
Add:
- very small
- balanced default
- quality-first larger local option
- one strong long-context or stronger retrieval option if desired

##### Vision
Add:
- lightweight OCR-ish / screenshot-friendly option
- better document/image understanding option
- clear notes for scanned PDFs vs general photos

##### Image
Add:
- lightweight fast image model
- higher-quality but heavier model
- note if a model is not realistically local for small systems

#### Important rule
For curated candidates, prefer truth over breadth. A smaller but accurate curated set is better than a large, weakly-labeled set.

#### Acceptance criteria
- the engine can produce distinct recommendations for low-end, mid-range, and higher-memory systems
- coding-heavy users are more likely to get coding-specific models
- document-heavy users get stronger retrieval defaults

---

### Fix 2B — Improve Hugging Face discovery queries

#### Files
- `src/core/huggingface/hfQueries.ts`
- `src/core/huggingface/hfClient.ts`
- `src/core/huggingface/parseModelInfo.ts`
- tests under `test/huggingface/`

#### Problem
Discovery currently uses only four broad templates. That is not enough for strong recommendation quality. fileciteturn2file0

#### Required change
Make discovery workload-aware and runtime-aware.

#### Recommended query groups

##### Text
- instruct
- chat
- coder instruct
- small local gguf
- 7b instruct
- 14b instruct

##### Embeddings
- embed
- embedding
- bge
- e5
- sentence similarity

##### Vision
- vision instruct
- image text to text
- vl
- document vision
- OCR or doc understanding if appropriate

##### Image
- diffusion
- text to image
- fast image generation
- local image model

#### Additional ranking metadata to fetch or use
- downloads
- likes
- pipeline tag
- library name
- tags
- gated/private status
- file formats
- file sizes

#### Acceptance criteria
- cache refresh builds a more diverse candidate pool
- coding queries discover coding models more reliably
- embedding pool includes more than generic “embed” matches

#### Tests
- mocked discovery results by category
- ensure dedupe across overlapping searches
- ensure gated/private models are filtered as intended

---

### Fix 2C — Replace naive task inference with metadata scoring

#### Files
- `src/core/huggingface/parseModelInfo.ts`
- optionally introduce `src/core/huggingface/inferTasks.ts`

#### Problem
Task classification from discovered models is too dependent on model id substrings like `coder` and `instruct`. fileciteturn2file0

#### Required change
Infer tasks from multiple signals.

#### Recommended inference signals
- `pipeline_tag`
- model tags
- library name
- model id patterns
- curated family overrides
- explicit repo file hints where useful

#### Example mapping strategy
```ts
function inferTasks(kind: CandidateModel["kind"], item: HfModelListItem): string[] {
  const tags = new Set((item.tags ?? []).map((t) => t.toLowerCase()));
  const id = item.id.toLowerCase();
  const tasks = new Set<string>();

  if (kind === "embedding") {
    tasks.add("embeddings");
    tasks.add("documents");
    return [...tasks];
  }

  if (kind === "vision") {
    tasks.add("vision");
    tasks.add("screenshots");
    tasks.add("photos");
    if (tags.has("document-understanding") || id.includes("doc")) {
      tasks.add("documents");
    }
    return [...tasks];
  }

  if (kind === "image") {
    tasks.add("text_to_image");
    return [...tasks];
  }

  tasks.add("text_generation");
  tasks.add("general_chat");
  if (id.includes("coder") || tags.has("code") || tags.has("coding")) tasks.add("coding");
  if (id.includes("instruct") || tags.has("instruction-tuned")) tasks.add("writing");
  if (tags.has("rag") || tags.has("document-question-answering")) tasks.add("documents");
  return [...tasks];
}
```

#### Acceptance criteria
- discovered coding models are more often tagged for coding
- discovered document-capable models are more often tagged for documents
- vision models differentiate document use better

---

## Phase 3 — Make fit calculations more realistic

### Fix 3A — Split theoretical eligibility from practical fit

#### Files
- `src/core/scoring/eligibility.ts`
- `src/core/scoring/bundlePlanner.ts`
- possibly shared types

#### Problem
The engine currently mixes “can theoretically run” with “is a good practical recommendation right now.” fileciteturn0file0

#### Required change
Introduce two layers:

1. **Hard eligibility**
   - must satisfy absolute minimum constraints
2. **Practical fit**
   - prefers candidates that fit comfortably with current free memory and likely runtime overhead

#### Recommended model

##### Hard eligibility
- minimum RAM <= total RAM
- minimum VRAM <= total VRAM/unified memory if required
- local-only compatibility if required
- task compatibility
- not gated

##### Practical fit score
- uses free RAM
- uses runtime availability
- penalizes candidates that barely fit
- penalizes candidates whose recommended memory exceeds current free budget

#### Acceptance criteria
- output can honestly distinguish between “can run” and “good fit now”
- low-headroom systems get more conservative results

---

### Fix 3B — Improve memory modeling by runtime and format

#### Files
- `src/core/huggingface/parseModelInfo.ts`
- `src/core/scoring/loadStrategy.ts`
- possibly add `src/core/scoring/memoryModel.ts`

#### Problem
Current memory estimation treats many candidate classes too similarly. fileciteturn3file3turn3file4

#### Required change
Make memory estimates runtime-aware and format-aware.

#### Minimum improvements
- GGUF candidates get different defaults from safetensors candidates
- Ollama overhead is modeled separately from raw transformers loading
- unified memory systems get conservative headroom penalties
- image and vision models reflect larger burst usage more explicitly

#### Example approach
Create a helper:
```ts
function estimateRuntimeAdjustedMemory(candidate: CandidateModel): MemoryProfile {
  // apply runtime/format multipliers or overrides
}
```

#### Suggested heuristic multipliers for v1
These are still heuristics, but better separated:
- GGUF / llama.cpp / Ollama: lower RAM than equivalent safetensors full load
- safetensors + transformers: higher RAM and stronger VRAM sensitivity
- vision/image models: keep bigger burst headroom
- Apple unified memory: penalize aggressive always-loaded multi-model bundles

#### Acceptance criteria
- bundle memory estimates vary meaningfully by runtime/format
- always-loaded bundles on unified-memory Macs become more conservative

---

### Fix 3C — Make load strategy smarter

#### Files
- `src/core/scoring/loadStrategy.ts`
- `src/core/shared/utils.ts`

#### Problem
Current load strategy is mostly driven by hardware band and secondary-model count. It should also reflect actual model size and headroom. fileciteturn3file3turn2file0

#### Required change
Choose load strategy using:
- actual combined recommended RAM
- current free RAM
- unified-memory pressure
- image/vision burst cost

#### Target behavior
- tiny/small systems strongly prefer on-demand loading
- always-loaded only appears when combined bundle headroom is clearly comfortable
- image generation almost never stays always-loaded on moderate systems

---

## Phase 4 — Make recommendations more honest and less hallucination-prone

### Fix 4A — Add provenance and confidence labels to candidates

#### Files
- `src/core/shared/schemas.ts`
- `src/core/shared/types.ts`
- `src/core/huggingface/parseModelInfo.ts`
- `src/core/models/*`
- output renderers

#### Problem
The system already has `source` and `discoveryConfidence`, but the final report does not surface enough of that distinction. fileciteturn2file0

#### Required change
For each recommended component, show:
- source: seed / discovered / enriched
- metadata confidence: low / medium / high
- fit confidence: low / medium / high
- whether memory estimate is measured, inferred, or heuristic

#### Recommended schema additions
Add optional fields such as:
- `metadataConfidenceReason?: string[]`
- `memoryEstimateSource?: "explicit" | "file_size_inferred" | "heuristic"`
- `taskInferenceSource?: "curated" | "tag_inferred" | "id_inferred"`

#### Acceptance criteria
- the report makes clear what is a solid fact and what is an estimate
- low-confidence models are visibly lower-trust

---

### Fix 4B — Penalize low-confidence discovered candidates

#### Files
- `src/core/scoring/performance.ts`
- `src/core/scoring/quality.ts`
- or add a new confidence penalty helper

#### Problem
Discovered candidates can be treated too similarly to highly trusted curated candidates.

#### Required change
Apply a mild score penalty to low-confidence discovered candidates unless enriched metadata is strong.

#### Example
- high confidence: no penalty
- medium confidence: tiny penalty
- low confidence: visible penalty

This helps prevent “random discovery result” from outranking curated models unless its metadata is actually solid.

---

### Fix 4C — Add “why not recommended” explanations

#### Files
- `src/core/scoring/bundlePlanner.ts`
- output renderers

#### Problem
The user only sees what won, not why other classes were rejected.

#### Required change
Add optional explanation lines such as:
- “larger quality-first models were skipped because current free RAM is below the comfortable threshold”
- “vision was omitted because your stated workload does not require image understanding”
- “fully local image generation options were limited for this hardware profile”

This makes the engine feel less hallucinated and more grounded.

---

### Fix 4D — Tone down overconfident wording in the report

#### Files
- `src/core/output/renderRecommendations.ts`
- `src/core/export/exportMarkdown.ts`

#### Problem
Current language can sound stronger than the evidence warrants. fileciteturn0file0

#### Required change
Replace absolute-sounding phrasing with calibrated wording.

#### Examples
Instead of:
- “This is the strongest overall balance...”

Use:
- “This is the strongest overall balance among the current viable candidates for your system and stated goals.”

Instead of:
- “keeps the total stack within a realistic local budget”

Use:
- “is estimated to keep the total stack within a realistic local budget based on detected hardware and current heuristics.”

#### Acceptance criteria
- wording matches the certainty level of the underlying data
- low-confidence outputs read clearly as estimated, not guaranteed

---

## Phase 5 — Add strong tests and fixtures

### Fix 5A — Add unit tests for all critical logic

#### Test areas

##### System detection
- macOS GPU parsing
- Linux NVIDIA detection and non-NVIDIA fallback
- Windows PowerShell JSON parsing and malformed fallback

##### Questionnaire normalization
- image generation without vision
- scanned PDFs force vision
- document and chat workflows force embeddings

##### Eligibility and scoring
- local-only filtering
- total RAM hard limit
- free RAM practical-fit penalty
- no unsafe fallback behavior

##### Candidate parsing
- repo format parsing
- task inference from tags/id/pipeline info
- memory estimate source tagging

##### Final ranking
- bundle diversity across labels
- best overall / fastest / best quality do not duplicate unless necessary
- no-fit scenario is explicit and truthful

#### Acceptance criteria
- critical branches have tests
- regressions in detection and bundle safety are caught automatically

---

### Fix 5B — Add golden fixtures for known machines

#### Recommended fixtures
Create example machine profiles such as:
- 8 GB RAM no GPU
- 16 GB unified-memory MacBook Air
- 24 GB unified-memory MacBook Air M4
- 32 GB Windows with midrange GPU
- 64 GB desktop with strong GPU

#### Use cases to test against each
- general chat only
- coding only
- chat + documents
- screenshots/scanned PDFs
- image generation
- mixed workflow

#### Goal
These fixtures let you verify that recommendation output is directionally sensible across common machine classes.

---

## Phase 6 — Improve data model and output format

### Fix 6A — Add explicit recommendation fit state

#### Files
- shared types/schemas
- scoring and rendering pipeline

#### Recommended enum
```ts
fitState: "comfortable" | "tight" | "degraded" | "not_recommended"
```

#### Meaning
- `comfortable`: should run well locally
- `tight`: likely works but with caution
- `degraded`: possible only with compromises
- `not_recommended`: should not be surfaced as a normal recommendation

This is a big step toward not hallucinating fit.

---

### Fix 6B — Separate measured system facts from inferred system facts

#### Files
- `src/core/shared/schemas.ts`
- `src/core/system/detectSystem.ts`
- output renderers

#### Recommended additions
For system profile fields, track whether they are:
- measured directly
- inferred from fallback logic
- unknown

#### Example
```ts
facts: {
  gpuModelSource: "measured" | "inferred" | "unknown";
  gpuMemorySource: "measured" | "inferred" | "unknown";
  unifiedMemorySource: "measured" | "inferred" | "unknown";
}
```

This will help prevent the UI from sounding like every hardware field is equally reliable.

---

## Concrete task list for Cursor

Use this as the execution checklist.

### Task group A — correctness
- [ ] Fix macOS GPU detection in `src/core/system/detectMac.ts`
- [ ] Update `detectSystem()` confidence and warnings if GPU details are missing
- [ ] Remove `image_generation` from `requiresVision` logic
- [ ] Remove unsafe fallback behavior in `pickTop()`
- [ ] Add explicit no-fit or degraded-fit behavior
- [ ] Fix launcher pathing and sync README instructions

### Task group B — recommendation quality
- [ ] Expand curated text candidates
- [ ] Expand curated embedding candidates
- [ ] Expand curated vision candidates
- [ ] Expand curated image candidates
- [ ] Add stronger discovery queries in `hfQueries.ts`
- [ ] Improve task inference using tags, pipeline, family, and ids

### Task group C — realism and honesty
- [ ] Split hard eligibility from practical fit
- [ ] Add runtime-aware and format-aware memory heuristics
- [ ] Improve load-strategy selection based on real headroom
- [ ] Add fit-state labels
- [ ] Add candidate provenance/confidence in final report
- [ ] Tone down overconfident report language
- [ ] Add “why not recommended” explanations

### Task group D — tests
- [ ] Add system detection unit tests
- [ ] Add questionnaire normalization tests
- [ ] Add candidate parsing tests
- [ ] Add scoring safety tests
- [ ] Add ranking diversity tests
- [ ] Add known-machine golden fixture tests

---

## Suggested code changes by file

### `src/core/system/detectMac.ts`
Replace CPU-brand-as-GPU logic with `system_profiler` parsing. Never populate `gpuModel` from CPU fields.

### `src/core/system/detectSystem.ts`
Add stronger warning/confidence handling when GPU model or GPU memory is unknown or inferred.

### `src/core/questionnaire/normalizeAnswers.ts`
Remove the image-generation-to-vision link. Keep image generation independent unless image understanding is also required.

### `src/core/scoring/eligibility.ts`
Split hard eligibility from practical fit. Introduce helpers like:
- `isCandidateHardEligible()`
- `getCandidateFitPenalty()`

### `src/core/scoring/bundlePlanner.ts`
Remove unsafe fallback behavior. Add explicit no-fit handling or degraded-fit handling. Include fit state, richer warnings, and “why not selected” notes.

### `src/core/scoring/loadStrategy.ts`
Use actual bundle memory characteristics and headroom to choose load strategy. Make unified-memory systems more conservative.

### `src/core/scoring/performance.ts`
Incorporate discovery confidence and practical headroom penalties.

### `src/core/scoring/quality.ts`
Use stronger task-fit logic and confidence calibration.

### `src/core/scoring/finalRank.ts`
Allow honest no-fit or degraded-fit outputs. Keep bundle diversity logic, but do not force label coverage when only bad fits remain.

### `src/core/huggingface/hfQueries.ts`
Expand query templates by workload and runtime.

### `src/core/huggingface/parseModelInfo.ts`
Add better task inference, more nuanced parameter/runtime heuristics, and metadata provenance tags.

### `src/core/models/*.ts`
Expand curated candidates and annotate them with more confidence-rich metadata.

### `src/core/output/renderRecommendations.ts`
Render provenance, confidence, fit state, and clearer warnings. Use calibrated wording.

### `src/core/export/exportMarkdown.ts`
Match the richer final report so exported Markdown includes confidence and fit-state details.

### `README.md`
Update install/bootstrap instructions and explain that recommendations are based on a mix of measured hardware facts, curated metadata, discovered metadata, and memory heuristics.

---

## Suggested new helpers and modules

Consider adding these files:

- `src/core/system/parseMacGpu.ts`
- `src/core/huggingface/inferTasks.ts`
- `src/core/scoring/memoryModel.ts`
- `src/core/scoring/fitState.ts`
- `src/core/scoring/explanations.ts`
- `test/fixtures/machines/*.json`

This keeps the current architecture clean while making logic easier to test.

---

## Recommended output changes

The recommendation report should explicitly show:

- system fact confidence
- candidate metadata confidence
- fit state
- estimated peak RAM/VRAM
- whether memory estimate is heuristic
- why this stack won
- what was excluded and why

### Example target output section
```md
## Best Overall

- Text Model: Qwen/Qwen2.5-7B-Instruct
- Embedding Model: BAAI/bge-base-en-v1.5
- Vision Model: None
- Image Model: None
- Load Strategy: on_demand_secondary
- Fit State: comfortable
- Fit Confidence: medium
- Candidate Provenance: curated seed + enriched metadata
- Peak RAM Estimate: 18 GB (heuristic)

Why this fits:
- Best overall among currently viable candidates for your detected hardware and stated workflow.
- Keeps retrieval consistent with a single embedding space.
- Avoids unnecessary vision overhead because your selected workflow does not require image understanding.

Tradeoffs:
- Larger quality-first bundles were skipped because current free RAM is below the comfortable threshold.
```

This is much more grounded than simply sounding definitive.

---

## Recommended rollout order

### Milestone 1 — correctness and safety
Do these first:
1. fix macOS GPU detection
2. fix image-generation vision logic
3. remove unsafe fallback behavior
4. fix launcher/docs mismatch
5. add tests for these four

### Milestone 2 — better recommendation quality
Then do:
1. expand curated registry
2. expand HF discovery
3. improve task inference
4. add fixture-based comparison tests

### Milestone 3 — trustworthiness and calibrated output
Then do:
1. fit state
2. provenance/confidence rendering
3. runtime-aware memory model
4. tone-down overconfident output language
5. add “why not recommended” explanations

---

## Definition of done

ModelStack should only be considered “fixed” when all of the following are true:

- system scan does not present false hardware facts
- recommendations never silently rely on impossible or misleading fallbacks
- image generation does not automatically force a vision model
- low-memory and local-only scenarios are handled honestly
- candidate discovery is broader and more workload-aware
- task inference is better than id-substring guessing alone
- reports show confidence and estimate provenance clearly
- tests cover the critical detection, scoring, and ranking paths
- docs and launcher paths match the actual repo structure

---

## Final guidance for implementation

When in doubt, bias toward conservative truth.

For ModelStack, a slightly smaller but honest recommendation is much better than a flashy but questionable one. The engine should prefer saying:
- “this is the strongest comfortable fit among the current candidates”

instead of:
- “this is the best model stack”

unless it truly has strong enough evidence.

That one philosophy change will reduce hallucination risk across the whole project.

