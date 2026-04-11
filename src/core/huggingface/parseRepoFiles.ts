export function parseRepoFiles(
  siblings?: Array<{ rfilename?: string; lfs?: { size?: number } }>,
): { formats: Array<"gguf" | "safetensors" | "onnx" | "other">; largestFileGb?: number } {
  if (!siblings || siblings.length === 0) {
    return { formats: ["other"] };
  }

  const formats = new Set<"gguf" | "safetensors" | "onnx" | "other">();
  let largestBytes = 0;

  for (const sibling of siblings) {
    const fileName = sibling.rfilename?.toLowerCase() ?? "";
    if (fileName.endsWith(".gguf")) {
      formats.add("gguf");
    } else if (fileName.endsWith(".safetensors")) {
      formats.add("safetensors");
    } else if (fileName.endsWith(".onnx")) {
      formats.add("onnx");
    } else {
      formats.add("other");
    }

    largestBytes = Math.max(largestBytes, sibling.lfs?.size ?? 0);
  }

  const largestFileGb = largestBytes > 0 ? Math.round((largestBytes / 1024 ** 3) * 10) / 10 : undefined;
  return largestFileGb === undefined ? { formats: [...formats] } : { formats: [...formats], largestFileGb };
}
