import { describe, expect, it } from "vitest";

import { inferDiscoveryConfidenceFromHfItem, inferTasksFromHfItem } from "../src/core/huggingface/inferTasks.js";

describe("inferTasksFromHfItem", () => {
  it("tags coding models from HF tags", () => {
    const tasks = inferTasksFromHfItem("text", {
      id: "org/Generic-7B",
      tags: ["code", "text-generation"],
      pipeline_tag: "text-generation",
    });
    expect(tasks).toContain("coding");
  });

  it("infers document tasks from DQA tag", () => {
    const tasks = inferTasksFromHfItem("text", {
      id: "org/rag-model",
      tags: ["document-question-answering"],
    });
    expect(tasks).toContain("documents");
  });

  it("adds document task for vision doc-style ids", () => {
    const tasks = inferTasksFromHfItem("vision", {
      id: "org/doc-vision-v1",
      tags: [],
    });
    expect(tasks).toContain("documents");
  });
});

describe("inferDiscoveryConfidenceFromHfItem", () => {
  it("returns low when signals are thin", () => {
    expect(
      inferDiscoveryConfidenceFromHfItem("text", {
        id: "x/y",
      }),
    ).toBe("low");
  });

  it("returns higher confidence when pipeline and tags exist", () => {
    expect(
      inferDiscoveryConfidenceFromHfItem("embedding", {
        id: "x/y",
        pipeline_tag: "sentence-similarity",
        tags: ["sentence-transformers"],
      }),
    ).toBe("high");
  });
});
