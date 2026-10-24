import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_VALUE, MODEL_OPTIONS, findModel } from "@/lib/ai/models";

describe("model catalog", () => {
  it("has unique values and a valid default", () => {
    const values = MODEL_OPTIONS.map((m) => m.value);
    expect(new Set(values).size).toBe(values.length);
    expect(findModel(DEFAULT_MODEL_VALUE)?.provider).toBe("lovable");
  });

  it("only lists providers the server knows how to call", () => {
    for (const m of MODEL_OPTIONS) {
      expect(["lovable", "groq", "gemini"]).toContain(m.provider);
      expect(m.value).toBe(`${m.provider}:${m.modelId}`);
    }
  });

  it("rejects unknown or non-string model values", () => {
    expect(findModel("groq:not-a-model")).toBeUndefined();
    expect(findModel(undefined)).toBeUndefined();
    expect(findModel(42)).toBeUndefined();
  });
});
