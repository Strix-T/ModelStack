import { execa } from "execa";

import type { RecommendedBundle } from "../core/shared/types.js";
import { collectOllamaPullTags } from "./ollamaTargets.js";

export type DownloadModelsDeps = {
  execaImpl?: typeof execa;
  /** Stream pull output (e.g. Electron main has no TTY for `stdio: "inherit"`). */
  onPullChunk?: (chunk: string) => void;
};

export type OllamaPullResult =
  | { ok: true; pulledTags: string[] }
  | { ok: false; userMessage: string }
  | { ok: "skipped"; reason: string };

export async function pullOllamaModelsForBundle(
  bundle: RecommendedBundle,
  deps: DownloadModelsDeps = {},
): Promise<OllamaPullResult> {
  const tags = collectOllamaPullTags(bundle);
  if (tags.length === 0) {
    return {
      ok: "skipped",
      reason:
        "No `ollama pull <tag>` hints were attached to this bundle. Follow the printed setup steps or pull a tag manually.",
    };
  }

  const run = deps.execaImpl ?? execa;
  const stream = Boolean(deps.onPullChunk);
  for (const tag of tags) {
    const subprocess = run("ollama", ["pull", tag], {
      reject: false,
      stdin: "ignore",
      stdout: stream ? "pipe" : "inherit",
      stderr: stream ? "pipe" : "inherit",
    });
    if (stream && deps.onPullChunk) {
      const cb = deps.onPullChunk;
      if (subprocess.stdout) {
        subprocess.stdout.on("data", (buf: Buffer | string) => {
          cb(typeof buf === "string" ? buf : buf.toString());
        });
      }
      if (subprocess.stderr) {
        subprocess.stderr.on("data", (buf: Buffer | string) => {
          cb(typeof buf === "string" ? buf : buf.toString());
        });
      }
    }
    const r = await subprocess;
    if (r.exitCode !== 0) {
      return {
        ok: false,
        userMessage: `Could not download the model "${tag}". Check your internet connection and free disk space, then run apply again (pulls can resume).`,
      };
    }
  }

  return { ok: true, pulledTags: tags };
}
