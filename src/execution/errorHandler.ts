export function formatExecutionError(err: unknown, debug: boolean): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("enonet") || (msg.includes("spawn") && msg.includes("ollama"))) {
      return "Ollama is not available on this machine. Install it from https://ollama.com and ensure `ollama` is on your PATH, then try again.";
    }
    if (msg.includes("eacces") || msg.includes("permission")) {
      return "ModelStack could not run a needed command because of permissions. Check that your terminal can run `ollama`, or try again from a normal user session.";
    }
    if (msg.includes("enospc") || msg.includes("no space")) {
      return "Your disk ran out of space while downloading. Free some space and run apply again; Ollama can resume pulls for the same tags.";
    }
    if (debug) {
      return err.stack ?? err.message;
    }
    return "Something went wrong while applying your stack. Set MODELSTACK_DEBUG=1 and try again if you need technical details.";
  }
  if (debug) {
    return String(err);
  }
  return "Something went wrong while applying your stack.";
}
