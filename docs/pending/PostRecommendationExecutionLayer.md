# ModelStack Post-Recommendation Execution Layer (v1 Spec)

## 🎯 Goal

Transform ModelStack from a **recommendation engine** into a **fully automated local AI setup system**.

> A non-technical user should be able to:
>
> 1. Run ModelStack
> 2. Accept a recommended stack
> 3. Have everything installed, configured, and launched automatically
> 4. Start using AI immediately

---

## 🧠 Core Principle

> **“If ModelStack can do it, the user should never have to.”**

* Zero technical assumptions
* No manual installs unless absolutely unavoidable
* Clear fallback instructions when automation fails

---

## 🏗️ New System Layer: “Apply Stack”

### New CLI Command

```bash
modelstack apply
```

### Flow Overview

```
Recommendation → User selects → Apply Stack → Install → Configure → Launch → Use AI
```

---

## 🧩 System Architecture

### 1. Stack Executor Module

**File:** `/src/execution/applyStack.ts`

Responsibilities:

* Accept selected `RecommendedBundle`
* Orchestrate full setup pipeline
* Track progress state

---

### 2. Execution Pipeline

#### Step 1: Validate System

* Re-check system compatibility
* Ensure RAM/VRAM fits selected models
* Confirm storage availability

If failed:

* Auto-downgrade to next best bundle
* OR prompt user with simple explanation

---

#### Step 2: Runtime Manager

**Goal:** Ensure required runtime is installed

Supported runtimes:

* Ollama
* llama.cpp
* Python (Transformers)

##### Behavior:

| Runtime             | Action                   |
| ------------------- | ------------------------ |
| Installed           | Skip                     |
| Missing             | Auto-install             |
| Cannot auto-install | Show guided instructions |

##### Example UX:

```
Setting up AI engine...

✔ Ollama installed
✖ Python not found → Installing automatically...
```

---

#### Step 3: Model Downloader

**File:** `/src/execution/downloadModels.ts`

Responsibilities:

* Pull/download all models in bundle:

  * text model
  * embedding model (if required)
  * vision model (if required)
  * image model (if required)

##### Behavior:

* Show progress per model
* Estimate download size/time
* Handle retries

##### UX:

```
Downloading models...

[1/3] Text Model (7GB) ███████░░░ 72%
[2/3] Embedding Model (400MB) ✔
[3/3] Vision Model (8GB) ⏳
```

---

#### Step 4: Local Environment Setup

Create:

```
/modelstack-project/
  /models
  /data
  /documents
  /images
  config.json
```

##### Config Example:

```json
{
  "textModel": "Qwen2.5-7B",
  "embeddingModel": "bge-base-en",
  "visionModel": "Qwen2.5-VL",
  "mode": "local",
  "features": {
    "documents": true,
    "vision": true,
    "imageGeneration": false
  }
}
```

---

#### Step 5: Feature Setup (Auto)

Based on user intent:

| Feature          | Setup                      |
| ---------------- | -------------------------- |
| Documents        | Create ingestion pipeline  |
| Vision           | Enable image routing       |
| Image Generation | Enable generation endpoint |

---

#### Step 6: Document Ingestion (If Needed)

If embeddings required:

##### Flow:

1. Ask user:

   ```
   Do you want to add documents now?
   ```
2. If yes:

   * Let user drag/drop or select folder
   * Auto:

     * chunk
     * embed
     * index

##### UX:

```
Adding your files...

✔ 24 documents processed
✔ Ready for AI questions
```

---

#### Step 7: Launch AI Interface

Launch one of:

* CLI chat (default)
* Local web UI (optional)
* Desktop app (future)

---

## 💬 User Experience (Non-Technical)

### Golden Path

```
> modelstack recommend

✔ Found best setup for your computer

> modelstack apply

Setting things up for you...

✔ Installing AI engine
✔ Downloading models
✔ Preparing your workspace

You're ready!

Start chatting:
> modelstack chat
```

---

## 🖥️ CLI Commands

### Core Commands

```bash
modelstack recommend
modelstack apply
modelstack chat
modelstack ingest
modelstack status
```

---

## 🧠 Smart Automation Rules

### Load Strategy Integration

Use existing logic:

* `always_loaded`
* `on_demand_secondary`
* `lightweight_all_local`
* `degraded_local`

Automatically configure model loading behavior.

---

## ⚠️ Failure Handling (Critical UX)

### Rule:

> Never show raw errors to users

### Instead:

#### Bad:

```
Error: CUDA not found
```

#### Good:

```
Your computer doesn’t have a compatible GPU.
We’ll switch to a CPU-based setup instead.
```

---

### Fallback Types

| Issue           | Action              |
| --------------- | ------------------- |
| Not enough RAM  | Downgrade model     |
| Missing runtime | Install             |
| Install fails   | Show copy-paste fix |
| Download fails  | Retry + resume      |

---

## 🧾 Guided Instructions System

If ModelStack cannot automate something:

### Example:

```
We need your help for one step:

1. Click this link:
   https://ollama.com/download

2. Install it (takes ~2 minutes)

3. Come back and press ENTER
```

---

## 📊 Progress Tracking

### Display Progress State

```
[✔] System Check
[✔] Runtime Setup
[⏳] Model Download
[ ] Environment Setup
[ ] Launch
```

---

## 🔐 Safety & Control

* Ask before:

  * downloading large models (>10GB)
  * using disk >80%
* Allow cancel at any step

---

## 🚀 Future Enhancements (v2)

* One-click GUI installer
* Auto GPU optimization (Metal/CUDA tuning)
* Background model downloading
* Multi-stack switching
* Cloud fallback mode
* Plugin system (RAG pipelines, agents)

---

## 🧪 Testing Requirements

### Must Test:

* 8GB RAM system (degraded mode)
* 16GB system (standard)
* 32GB+ system (multi-model)
* No GPU
* GPU present
* No runtimes installed

---

## 🧩 Key Missing Files to Build

```
/execution/
  applyStack.ts
  runtimeManager.ts
  downloadModels.ts
  setupEnvironment.ts
  ingestDocuments.ts
  launchInterface.ts
  progressTracker.ts
  errorHandler.ts
```

---

## 🏁 Definition of Done

User can:

* Run ModelStack
* Accept recommendation
* Automatically install everything
* Open a chat
* Ask a question

**Without touching code, terminals (beyond commands), or configs**

---

## 💡 Final Product Vision

ModelStack becomes:

> “The easiest way in the world to run AI locally”

NOT:

* a model picker
* a dev tool

BUT:

* a **complete AI onboarding system**

---
