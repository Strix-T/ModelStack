
# Cursor-Ready Build Plan: Local AI Model Stack Selector CLI

## 1. Product Definition

### Goal
Build a terminal-based CLI tool that helps users choose the best **local AI model stack** for their computer.

The tool should:
- detect the user's machine specs
- ask simple plain-English questions about what they want to do
- search and score model candidates
- recommend the best **stack**, not just one model
- present results in a clean, visually pleasant terminal UI

### Core Product Idea
This is **not** a generic Hugging Face browser.

This tool is a:
- hardware-aware
- task-aware
- stack-aware

local AI recommendation engine.

### What it recommends
A recommended stack can include:
- **1 text/inference model**
- **1 embedding model**
- **0 or 1 vision model**
- **0 or 1 image generation model**
- a **load strategy**
  - always loaded
  - load on demand
  - cloud fallback later if ever added

---

## 2. Product Rules

### Rule 1: Recommend stacks, not isolated models
Do not score models in isolation when the user needs multiple capabilities.

Bad:
- best text model
- best image model

Correct:
- best combined setup for this specific machine

### Rule 2: Embedding model consistency
Only one embedding model should be active per vector database/index.

Never mix embeddings from multiple models inside the same index.

### Rule 3: Total system budget matters
When user needs multiple capabilities, score against:
- RAM
- VRAM
- CPU/GPU
- storage
- expected load strategy

### Rule 4: Keep the CLI friendly
Questions should be simple, not technical.

Bad:
- “Do you need multimodal inference?”

Good:
- “Will you want the AI to look at screenshots, photos, or scanned PDFs?”

---

## 3. MVP Scope

### In scope for v1
- CLI only
- local-first recommendation engine
- Hugging Face model discovery support
- curated candidate lists allowed
- text generation model recommendation
- embedding model recommendation
- optional vision model recommendation
- optional image generation model recommendation
- stack bundle scoring
- pleasant terminal UI
- JSON cache / local registry support

### Out of scope for v1
- GUI app
- automatic model downloading
- automatic Ollama installs
- benchmarking every model on the machine
- running huge real-world eval suites
- cloud provider integrations
- full Windows/Linux/macOS feature parity on day one if it slows launch
- support for every model format on Hugging Face

### Recommended v1 target
Prioritize:
- macOS Apple Silicon
- Windows second
- Linux third

---

## 4. Tech Stack

### Recommended stack
- **TypeScript**
- **Node.js**
- **Commander** or **Clack** for CLI structure
- **@inquirer/prompts** or **prompts** for questionnaire
- **chalk** for colors
- **boxen** for framed output
- **ora** for spinners
- **cli-table3** for tables
- **gradient-string** optional, use lightly
- **huggingface_hub via Python subprocess** OR direct HF HTTP API from Node
- **systeminformation** for hardware detection where possible
- **execa** for shelling out to system tools
- **zod** for schemas and validation
- **lowdb**, JSON files, or SQLite for local metadata cache

### Recommended repo language choice
Use **TypeScript** for the CLI unless there is a very strong reason to use Python.

Why:
- easy cross-platform CLI packaging
- great terminal libraries
- strong typing
- easier future move into TUI or desktop app

---

## 5. CLI User Experience

### Product promise
“Tell us what you want AI to do, and we’ll recommend the best local model setup your computer can realistically run.”

### Example user flow
1. user runs the CLI
2. CLI scans hardware
3. CLI asks a short questionnaire
4. CLI fetches model candidates
5. CLI scores candidate bundles
6. CLI displays:
   - Best Overall
   - Fastest
   - Best Quality
   - Fully Local
7. CLI offers export to Markdown or JSON

### Terminal style goals
- clean spacing
- subtle colors
- framed sections
- no clutter
- concise language
- bold headings
- tables for summaries
- icons used sparingly

Example sections:
- System Scan
- Your Needs
- Candidate Analysis
- Recommended Stacks
- Why These Were Chosen
- Next Steps

---

## 6. CLI Commands

### Core commands
```bash
modelstack recommend
modelstack scan
modelstack questionnaire
modelstack cache refresh
modelstack export --format md
modelstack export --format json
```

### Suggested initial commands
```bash
modelstack recommend
modelstack recommend --fast
modelstack recommend --offline-only
modelstack recommend --json
modelstack scan
modelstack cache refresh
```

### Suggested future commands
```bash
modelstack benchmark
modelstack install
modelstack explain <model-id>
modelstack compare
```

---

## 7. Folder Structure

```text
modelstack-cli/
├─ src/
│  ├─ cli/
│  │  ├─ index.ts
│  │  ├─ commands/
│  │  │  ├─ recommend.ts
│  │  │  ├─ scan.ts
│  │  │  ├─ refresh-cache.ts
│  │  │  └─ export.ts
│  ├─ core/
│  │  ├─ questionnaire/
│  │  │  ├─ questions.ts
│  │  │  ├─ flows.ts
│  │  │  └─ normalizeAnswers.ts
│  │  ├─ system/
│  │  │  ├─ detectSystem.ts
│  │  │  ├─ detectMac.ts
│  │  │  ├─ detectWindows.ts
│  │  │  ├─ detectLinux.ts
│  │  │  └─ types.ts
│  │  ├─ huggingface/
│  │  │  ├─ hfClient.ts
│  │  │  ├─ hfQueries.ts
│  │  │  ├─ parseModelInfo.ts
│  │  │  ├─ parseRepoFiles.ts
│  │  │  └─ types.ts
│  │  ├─ models/
│  │  │  ├─ candidateRegistry.ts
│  │  │  ├─ curatedEmbeddings.ts
│  │  │  ├─ curatedVision.ts
│  │  │  ├─ curatedImageGen.ts
│  │  │  └─ curatedText.ts
│  │  ├─ scoring/
│  │  │  ├─ eligibility.ts
│  │  │  ├─ performance.ts
│  │  │  ├─ quality.ts
│  │  │  ├─ preferences.ts
│  │  │  ├─ bundlePlanner.ts
│  │  │  ├─ loadStrategy.ts
│  │  │  └─ finalRank.ts
│  │  ├─ output/
│  │  │  ├─ renderHeader.ts
│  │  │  ├─ renderSystem.ts
│  │  │  ├─ renderRecommendations.ts
│  │  │  ├─ renderTables.ts
│  │  │  └─ renderWarnings.ts
│  │  ├─ export/
│  │  │  ├─ exportMarkdown.ts
│  │  │  └─ exportJson.ts
│  │  └─ shared/
│  │     ├─ constants.ts
│  │     ├─ schemas.ts
│  │     ├─ types.ts
│  │     └─ utils.ts
├─ cache/
│  ├─ models.json
│  └─ last-refresh.json
├─ docs/
│  ├─ scoring.md
│  ├─ questionnaire.md
│  └─ hf-integration.md
├─ package.json
├─ tsconfig.json
├─ README.md
└─ .env.example
```

---

## 8. Questionnaire Design

### Goal
Turn vague user intent into hard scoring filters.

### First-pass questions
1. What do you mainly want to use AI for?
   - General chat
   - Writing
   - Coding
   - Research and documents
   - Screenshots / photos / scanned PDFs
   - Image generation

2. What kinds of files will the AI work with?
   - Just text
   - Documents / PDFs
   - Screenshots / photos
   - Code files
   - A mix

3. Are your PDFs mostly:
   - Selectable text
   - Scanned pages / images
   - Both / not sure

4. What matters most?
   - Fast responses
   - Best quality
   - Balanced

5. Do you want everything fully local?
   - Yes
   - Prefer local
   - No preference

6. Are you okay with slower models if they are smarter?
   - Yes
   - No

7. Will you want image generation too?
   - Yes
   - No

### Adaptive logic
- If user does not need images, skip image-related branches
- If user only wants text chat, do not show scanned-PDF questions
- If user chooses coding, boost code-focused text models
- If user chooses screenshots/photos/scanned PDFs, require vision support
- If user chooses image generation, include an image model in the stack budget

---

## 9. Task Mapping

### Plain English to internal capabilities
- General chat -> text_generation
- Writing -> text_generation
- Coding -> text_generation + coding_bias
- Research and documents -> text_generation + embeddings
- Screenshots/photos/scanned PDFs -> vision + text_generation
- Image generation -> text_to_image

### Important distinction
Do not treat “PDF support” as a direct model capability.

Split it into:
- digital PDFs -> text extraction + text model
- scanned PDFs -> vision model or OCR pipeline + text model

---

## 10. System Detection Requirements

### Detect at minimum
- OS
- CPU model
- CPU core count
- RAM total
- free RAM estimate if possible
- GPU model
- GPU VRAM if available
- Apple Silicon unified memory when applicable
- available disk space

### Nice to have
- Metal support on macOS
- CUDA availability on Windows/Linux
- whether Ollama is installed
- whether llama.cpp is installed
- whether Python is installed
- whether user already has local models installed

### Output shape
```ts
type SystemProfile = {
  os: "macos" | "windows" | "linux";
  cpuModel: string;
  cpuCores: number;
  ramGb: number;
  gpuVendor?: string;
  gpuModel?: string;
  gpuVramGb?: number;
  unifiedMemoryGb?: number;
  storageFreeGb?: number;
  runtimes: {
    ollamaInstalled: boolean;
    llamaCppInstalled: boolean;
    pythonInstalled: boolean;
  };
};
```

---

## 11. Hugging Face Integration Strategy

### Important principle
Do not try to score the entire Hugging Face universe blindly in v1.

Use a hybrid approach:
- curated candidate lists
- Hugging Face metadata fetch
- repo/file inspection
- optional search-based discovery later

### What to fetch
For each candidate model:
- repo id
- task tags
- pipeline tags
- library tags
- model card snippets
- file list
- quantized file presence
- GGUF presence
- safetensors presence
- approximate file sizes where available
- modality clues
- license
- gated/public status

### v1 recommendation
Maintain curated registries for:
- text models
- embedding models
- vision models
- image generation models

Then enrich those candidates from Hugging Face.

This is more reliable than trying to parse every random repo on day one.

---

## 12. Candidate Pools

### Text model pool
Keep a curated list of practical local candidates, for example:
- small
- medium
- larger local-friendly

Store metadata like:
- preferred runtime
- family
- task strengths
- rough memory bands
- code friendliness
- vision support false

### Embedding pool
Use a smaller curated list.

Embedding selection should be much tighter than text selection.

Store:
- dimensions
- speed tier
- quality tier
- memory tier
- local friendliness

### Vision pool
Only include models intended for:
- screenshots
- image understanding
- scanned PDFs

### Image generation pool
Only include models intended for:
- text-to-image

---

## 13. Scoring Architecture

### Layer 1: Eligibility
Binary checks:
- does the model support required task?
- does the model fit likely runtime?
- is it available/public?
- does it fit the user’s rough hardware band?

### Layer 2: Performance Fit
Estimate:
- memory fit
- startup time
- expected responsiveness
- expected runtime compatibility

### Layer 3: Quality Fit
Estimate:
- chat quality
- coding quality
- document usefulness
- vision usefulness
- image generation usefulness

### Layer 4: Preference Fit
Adjust weights based on:
- fast vs quality
- local only vs prefer local
- okay with slower smarter models

### Layer 5: Bundle Fit
This is the critical part.

Score the combined stack:
- text + embedding
- text + embedding + vision
- text + embedding + image gen
- text + embedding + vision + image gen

A stack can only rank highly if the **whole bundle** fits.

---

## 14. Load Strategy Logic

### Strategies
1. **always_loaded**
   - only for smaller stacks on stronger systems

2. **on_demand_secondary**
   - keep text model active
   - load vision or image model only when needed

3. **lightweight_all_local**
   - all models are smaller and stay local

4. **degraded_local**
   - weaker machine
   - recommend smaller local models with more limits

### v1 recommendation
Favor:
- text model as primary
- embedding model used during indexing/query flows
- vision/image model on demand

This is the safest consumer-hardware strategy.

---

## 15. Recommendation Output Format

### Main output sections
1. System Summary
2. What You Told Us
3. Recommended Stacks
4. Why These Fit
5. Warnings / Tradeoffs
6. Suggested Next Commands

### Show at least these recommendations
- **Best Overall**
- **Fastest**
- **Best Quality**
- **Most Local-Friendly**

### Example recommendation block
```text
Best Overall
------------
Text Model:      <model>
Embedding Model: <model>
Vision Model:    <model or none>
Image Model:     <model or none>
Load Strategy:   on_demand_secondary

Why this fits:
- strong balance of quality and speed
- supports screenshots and scanned PDFs
- likely fits your RAM budget if image model is loaded only when needed
```

### Include warnings like
- “This image model may feel slow without a dedicated GPU.”
- “For scanned PDFs, a vision-capable stack is required.”
- “Switching embedding models later requires re-indexing your documents.”

---

## 16. Data Models

### Core answer shape
```ts
type UserIntent = {
  primaryUseCases: Array<
    | "general_chat"
    | "writing"
    | "coding"
    | "documents"
    | "vision_understanding"
    | "image_generation"
  >;
  inputTypes: Array<
    | "text"
    | "pdf_text"
    | "pdf_scanned"
    | "screenshots"
    | "photos"
    | "code"
  >;
  priority: "speed" | "quality" | "balanced";
  localPreference: "local_only" | "prefer_local" | "no_preference";
  allowsSlowSmart: boolean;
};
```

### Candidate model shape
```ts
type CandidateModel = {
  id: string;
  kind: "text" | "embedding" | "vision" | "image";
  family?: string;
  runtime: Array<"ollama" | "llamacpp" | "transformers" | "other">;
  tasks: string[];
  localFriendly: boolean;
  estimatedRamGb?: number;
  estimatedVramGb?: number;
  embeddingDimensions?: number;
  speedTier: 1 | 2 | 3 | 4 | 5;
  qualityTier: 1 | 2 | 3 | 4 | 5;
  notes?: string[];
};
```

### Bundle shape
```ts
type RecommendedBundle = {
  label: "best_overall" | "fastest" | "best_quality" | "most_local_friendly";
  textModel?: CandidateModel;
  embeddingModel?: CandidateModel;
  visionModel?: CandidateModel;
  imageModel?: CandidateModel;
  loadStrategy: string;
  score: number;
  reasons: string[];
  warnings: string[];
};
```

---

## 17. Implementation Phases

## Phase 1 — Foundation
### Goal
Get a working CLI shell and questionnaire.

### Tasks
- initialize repo
- set up TypeScript CLI
- add command parser
- add terminal styling libs
- build `modelstack scan`
- build `modelstack questionnaire`
- define core schemas and types

### Done when
- CLI runs cleanly
- user can answer questions
- system profile prints in terminal

---

## Phase 2 — System Detection
### Goal
Produce a reliable `SystemProfile`.

### Tasks
- implement macOS detection
- implement Windows detection
- implement Linux detection
- detect runtimes
- normalize units into GB
- add fallback handling for missing GPU info

### Done when
- all supported platforms produce a valid normalized system profile

---

## Phase 3 — Candidate Registry + HF Enrichment
### Goal
Create candidate pools and enrich from Hugging Face.

### Tasks
- create curated text candidate list
- create curated embedding list
- create curated vision list
- create curated image generation list
- create HF client
- fetch model metadata
- cache model data locally
- mark broken/gated/unusable candidates

### Done when
- you can refresh cache and inspect candidate metadata locally

---

## Phase 4 — Scoring Engine
### Goal
Rank models and bundles.

### Tasks
- implement eligibility scoring
- implement performance scoring
- implement preference weighting
- implement bundle planner
- implement load strategy chooser
- generate top 4 recommendation bundles

### Done when
- same input consistently yields sensible ranked stacks

---

## Phase 5 — Terminal Presentation
### Goal
Make the CLI visually pleasant and easy to understand.

### Tasks
- add framed headers
- add tables for system + recommendations
- add colored badges
- add warning blocks
- add concise explanation text
- add markdown export

### Done when
- terminal output looks polished and easy to scan

---

## Phase 6 — Testing + Hardening
### Goal
Make recommendations trustworthy.

### Tasks
- add unit tests for scoring
- add fixture-based tests for sample systems
- add snapshot tests for output
- test against low-end, mid-tier, high-end example machines
- verify adaptive questionnaire logic
- verify bundle planning tradeoffs

### Done when
- recommendations stay stable across known profiles

---

## 18. Example System Profiles for Tests

### Low-end
- 8 GB RAM
- no GPU
- older CPU

### Mid consumer laptop
- 16–24 GB RAM
- integrated GPU or Apple Silicon unified memory

### Strong creator machine
- 32–64 GB RAM
- dedicated GPU or strong unified memory

### High-end workstation
- 64+ GB RAM
- strong GPU

Use these fixtures to validate ranking behavior.

---

## 19. Scoring Heuristics for v1

### Hardware band examples
- **tiny**: under 8 GB RAM
- **small**: 8–15 GB
- **medium**: 16–31 GB
- **large**: 32–63 GB
- **xlarge**: 64+ GB

### Example logic
- if user wants text only, allocate more budget to text model
- if user wants text + image generation, reserve budget for both
- if user wants screenshots/scanned PDFs, vision is required
- if user wants only digital docs, prefer text + embedding
- if user wants speed, down-rank slower larger models
- if local only on weak machine, aggressively bias toward smaller bundles

### Embedding model logic
For v1, always recommend exactly one embedding model.

Never recommend multiple active embedding models for the same index.

---

## 20. Export Features

### Markdown export
Include:
- system summary
- answers summary
- recommendations
- explanations
- warnings

### JSON export
Useful for:
- future integrations
- scripting
- debug output
- benchmarks later

---

## 21. README Requirements

Your README should include:
- what the tool does
- how to install dependencies
- how to run locally
- available commands
- supported platforms
- what “stack” means
- why embedding models must stay consistent
- what scanned PDFs imply
- why the tool may recommend smaller bundles for multi-model use cases

---

## 22. Example Cursor Task List

## Task A — Bootstrap the CLI
Build a TypeScript Node CLI with commands:
- `modelstack recommend`
- `modelstack scan`
- `modelstack cache refresh`

Use:
- Commander or Clack
- chalk
- boxen
- ora
- cli-table3
- zod

Acceptance criteria:
- commands run successfully
- `scan` prints placeholder system output
- `recommend` can call a placeholder questionnaire

## Task B — Build system detection
Implement normalized hardware detection for:
- macOS
- Windows
- Linux

Acceptance criteria:
- returns `SystemProfile`
- handles missing GPU info safely
- prints a clean system summary table

## Task C — Build questionnaire engine
Implement an adaptive questionnaire that outputs `UserIntent`.

Acceptance criteria:
- skips irrelevant questions
- correctly maps PDFs into text vs scanned flows
- supports speed/quality/local preferences

## Task D — Build model registry
Create curated registries for:
- text
- embedding
- vision
- image generation

Acceptance criteria:
- local TS files or JSON registry
- each candidate has normalized metadata
- registry validates with zod

## Task E — Build Hugging Face enrichment
Fetch metadata for curated candidates and cache results locally.

Acceptance criteria:
- cache refresh command works
- HF fetch failures do not crash the app
- gated/private candidates are flagged

## Task F — Build scoring engine
Create layered scoring:
- eligibility
- performance
- quality
- preferences
- bundle fit

Acceptance criteria:
- returns top recommendation bundles
- weaker systems receive smaller bundles
- image tasks reserve stack budget correctly

## Task G — Build polished terminal output
Render recommendations in a professional terminal layout.

Acceptance criteria:
- headers
- tables
- reason bullets
- warnings
- no cluttered walls of text

## Task H — Build export support
Add:
- `--json`
- markdown export file support

Acceptance criteria:
- user can save recommendation report
- exported content matches terminal output meaningfully

---

## 23. Example Acceptance Criteria for v1 Launch

The CLI is ready for a first public test when:
- user can clone repo and run the CLI in terminal
- CLI detects their machine
- CLI asks a clear questionnaire
- CLI builds at least one valid stack recommendation
- CLI explains why it chose that stack
- output is attractive and easy to understand
- markdown export works
- recommendations are sensible across at least 4 hardware tiers

---

## 24. Future v2 Ideas

- one-command Ollama install suggestions
- benchmark top 3 candidates locally
- compare two stacks side by side
- install-ready output
- model family deep links
- OCR pipeline suggestions
- user-provided runtime preference
- existing-model detection from local machine
- auto-generate config files for downstream apps

---

## 25. Final Product Positioning

This CLI should be framed as:

> A smart local AI setup planner for real computers.

Not:
- “a list of Hugging Face models”
- “a model scraper”
- “a benchmark leaderboard”

The real value is:
- understanding what the user wants
- understanding what their machine can support
- recommending the right stack with the right tradeoffs

---

## 26. Immediate Build Recommendation

Start by building this exact path first:

1. `modelstack scan`
2. adaptive questionnaire
3. hardcoded candidate registry
4. bundle scoring engine
5. polished recommendation output
6. markdown export
7. only then add Hugging Face enrichment

That order keeps the product focused and shippable.

---

## 27. One-Line Summary

Build a polished CLI that scans a user’s machine, asks what they want AI to do, and recommends the best local **model stack** their system can realistically run.
