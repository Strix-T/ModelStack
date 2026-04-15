import { execa } from "execa";

export type RuntimeManagerDeps = {
  execaImpl?: typeof execa;
};

const OLLAMA_INSTALL_HINT =
  "Install Ollama from https://ollama.com (about two minutes), then open a new terminal and run this command again.";

export async function ensureOllamaCli(deps: RuntimeManagerDeps = {}): Promise<
  | { ok: true }
  | {
      ok: false;
      userTitle: string;
      userBody: string;
    }
> {
  const run = deps.execaImpl ?? execa;
  const result = await run("ollama", ["--version"], { reject: false });
  if (result.exitCode === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    userTitle: "Ollama is not installed or not on your PATH",
    userBody: [
      "We need your help for one step:",
      "",
      `1. Open: https://ollama.com/download`,
      "2. Install Ollama for your system.",
      "3. Open a **new** terminal window so your PATH updates.",
      "",
      OLLAMA_INSTALL_HINT,
    ].join("\n"),
  };
}
