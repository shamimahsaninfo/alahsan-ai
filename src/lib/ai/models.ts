// Model catalog shared by client and server. Keep this file free of secrets and server-only imports.
export type ProviderId = "lovable" | "groq" | "gemini";

export type ModelOption = {
  /** Stable value stored in the browser and sent to the server, e.g. "groq:openai/gpt-oss-120b". */
  value: string;
  provider: ProviderId;
  /** Model id as the provider names it. */
  modelId: string;
  label: string;
};

/**
 * Free-tier chat models, checked against the official Groq and Google Gemini docs.
 * Groq: production models on the Free Plan table (gpt-oss-120b, gpt-oss-20b).
 * Gemini: stable models with "Free of charge" Standard pricing. Gemini 2.5 and preview
 * models are excluded: Google limits 2.5 access for new projects and previews may be retired.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "lovable:openai/gpt-6-astra",
    provider: "lovable",
    modelId: "openai/gpt-6-astra",
    label: "ডিফল্ট (Lovable AI)",
  },
  {
    value: "groq:openai/gpt-oss-120b",
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    label: "Groq · GPT-OSS 120B",
  },
  {
    value: "groq:openai/gpt-oss-20b",
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    label: "Groq · GPT-OSS 20B",
  },
  {
    value: "gemini:gemini-3.8-flash",
    provider: "gemini",
    modelId: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
  },
  {
    value: "gemini:gemini-3.6-flash",
    provider: "gemini",
    modelId: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
  },
  {
    value: "gemini:gemini-3.5-flash-lite",
    provider: "gemini",
    modelId: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
  },
  {
    value: "gemini:gemini-3.1-flash-lite",
    provider: "gemini",
    modelId: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
  },
];

export const DEFAULT_MODEL_VALUE = "lovable:openai/gpt-6-astra";

export function findModel(value: unknown): ModelOption | undefined {
  if (typeof value !== "string") return undefined;
  return MODEL_OPTIONS.find((m) => m.value === value);
}
