# ModelStack CLI

ModelStack is a terminal-first local AI setup planner. It scans the machine, asks what the user wants AI to do, and recommends the best local model stack the system can realistically run.

## What "stack" means

A stack is the combined local setup, not just one model. A recommendation can include:

- one text model
- one embedding model
- an optional vision model
- an optional image-generation model
- a load strategy for how those models should coexist

Embedding consistency matters: one vector index should use one embedding model. Switching embedding models later means re-indexing.

ModelStack also assumes many local assistant workflows benefit from retrieval over past chats and ingested files, so general chat and other text-oriented stacks usually include an embedding model by default.

Scanned PDFs are also special: digital PDFs can flow through text extraction plus a text model, but scanned PDFs usually require a vision-capable stack.

## Requirements

- Node.js `>= 22`
- `pnpm >= 10`

## Desktop app (Electron)

A graphical wizard for macOS and Windows lives in `desktop/`. Development: `pnpm desktop:dev`. Packaged installers: `pnpm desktop:dist`. **Public releases** (signed + notarized Mac, signed Windows) use GitHub Actions when you push a `v*.*.*` tag; you must configure repository secrets first. See [docs/DESKTOP_RELEASE.md](docs/DESKTOP_RELEASE.md).

## Install

```bash
pnpm install
pnpm build
pnpm link --global
```

Then run:

```bash
modelstack scan
modelstack questionnaire
modelstack cache refresh
modelstack recommend
```

## Double-click launcher on macOS

If you want a Finder-friendly launcher, double-click `Run ModelStack.command` from the repo root.

That launcher will:

- open Terminal
- check for Homebrew
- install `Node.js 22` if needed
- activate `pnpm`
- install project dependencies
- build ModelStack
- launch `modelstack recommend`

You can also change the launched command from Terminal:

```bash
MODELSTACK_COMMAND="scan --json" ./scripts/bootstrap_modelstack_mac.sh
```

If you need the full bootstrap logs for troubleshooting:

```bash
MODELSTACK_BOOTSTRAP_VERBOSE=1 ./scripts/bootstrap_modelstack_mac.sh
```

## Commands

```bash
modelstack scan [--json]
modelstack questionnaire [--json]
modelstack cache refresh [--force]
modelstack recommend [--json] [--markdown <path>] [--offline-only] [--fast]
```

## Supported platforms

The CLI is designed to run on:

- macOS
- Windows
- Linux

Hardware probing degrades gracefully where an OS does not expose the same GPU details. Lower-confidence hardware scans push the recommendation engine toward smaller, safer stacks.

## Why recommendations may look conservative

ModelStack scores the whole bundle budget, not isolated model scores. A system that can run one larger text model in isolation may still get a smaller recommendation when the desired workflow also needs embeddings, vision, or image generation.
